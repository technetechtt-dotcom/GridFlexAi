/**
 * Concurrent Socket.IO connections + optional fan-out timing.
 *
 * Usage:
 *   node load/socketio-fanout.mjs --url http://localhost:4000 --clients 50 --duration 30
 *   node load/socketio-fanout.mjs --url https://staging --token JWT --clients 100
 *
 * Measures connect success rate and time-to-connect p95. Fan-out delay requires
 * a publishing source (ingest); when --await-event is set, waits for first event.
 */

import { io } from "socket.io-client";

const args = process.argv.slice(2);
const get = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const url = get("--url", process.env.LOAD_BASE_URL || "http://localhost:4000");
const token = get("--token", process.env.LOAD_BEARER_TOKEN || "");
const clients = Number.parseInt(get("--clients", process.env.LOAD_SOCKET_CLIENTS || "50"), 10);
const durationSec = Number.parseInt(get("--duration", "30"), 10);
const awaitEvent = args.includes("--await-event");
const fanoutBudgetMs = Number.parseInt(get("--fanout-budget-ms", "2000"), 10);

if (!Number.isFinite(clients) || clients <= 0) {
  console.error("--clients must be positive");
  process.exit(2);
}

const connectTimes = [];
const eventTimes = [];
let connected = 0;
let failed = 0;
const sockets = [];

const percentile = (arr, p) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)];
};

const started = Date.now();

await Promise.all(
  Array.from({ length: clients }, (_, idx) => {
    return new Promise((resolve) => {
      const t0 = Date.now();
      const socket = io(url, {
        transports: ["websocket", "polling"],
        auth: token ? { token } : undefined,
        extraHeaders: token ? { Authorization: `Bearer ${token}` } : undefined,
        reconnection: false,
        timeout: 15000
      });
      sockets.push(socket);

      const done = (ok) => {
        if (ok) {
          connected += 1;
          connectTimes.push(Date.now() - t0);
        } else {
          failed += 1;
        }
        resolve();
      };

      socket.on("connect", () => {
        done(true);
        if (awaitEvent) {
          const e0 = Date.now();
          const onAny = () => {
            eventTimes.push(Date.now() - e0);
            socket.offAny(onAny);
          };
          socket.onAny(onAny);
        }
      });
      socket.on("connect_error", () => done(false));
      setTimeout(() => {
        if (!socket.connected) done(false);
      }, 16000);
    });
  })
);

console.log(`Connected ${connected}/${clients} (failed ${failed})`);
console.log(`Connect p50=${percentile(connectTimes, 50)}ms p95=${percentile(connectTimes, 95)}ms`);

await new Promise((r) => setTimeout(r, durationSec * 1000));

if (awaitEvent && eventTimes.length) {
  const p95 = percentile(eventTimes, 95);
  console.log(`Fan-out sample n=${eventTimes.length} p95=${p95}ms budget=${fanoutBudgetMs}ms → ${p95 <= fanoutBudgetMs ? "PASS" : "FAIL"}`);
  if (p95 > fanoutBudgetMs) process.exitCode = 1;
} else if (awaitEvent) {
  console.log("No events received during await window (ensure ingest publishers running).");
}

for (const s of sockets) {
  try {
    s.close();
  } catch {
    /* ignore */
  }
}

const availability = connected / clients;
console.log(`Availability ${(availability * 100).toFixed(2)}% elapsed=${Date.now() - started}ms`);
if (availability < 0.995 || failed > clients * 0.01) {
  process.exitCode = 1;
}
