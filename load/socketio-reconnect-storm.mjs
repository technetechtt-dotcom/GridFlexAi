/**
 * Socket.IO reconnect-storm probe.
 *
 * Cycles connect → disconnect for N clients over a window and reports
 * reconnect success rate and connect latency percentiles.
 *
 * Usage:
 *   node load/socketio-reconnect-storm.mjs --url http://127.0.0.1:4010 --token JWT \
 *     --clients 20 --cycles 5 --output go-live-reports/socket-reconnect-storm.json
 */

import { io } from "socket.io-client";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = process.argv.slice(2);
const get = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const url = get("--url", process.env.LOAD_BASE_URL || "http://localhost:4000");
const token = get("--token", process.env.LOAD_BEARER_TOKEN || "");
const clients = Number.parseInt(get("--clients", "20"), 10);
const cycles = Number.parseInt(get("--cycles", "5"), 10);
const namespace = get("--namespace", process.env.LOAD_SOCKET_NAMESPACE || "/");
const settleMs = Number.parseInt(get("--settle-ms", "250"), 10);
const outputPath = get("--output", process.env.LOAD_SOCKET_OUTPUT || "");

if (!Number.isFinite(clients) || clients <= 0 || !Number.isFinite(cycles) || cycles <= 0) {
  console.error("--clients and --cycles must be positive");
  process.exit(2);
}

const percentile = (arr, p) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)];
};

const connectOnce = () =>
  new Promise((resolve) => {
    const t0 = Date.now();
    const socket = io(new URL(namespace, url).toString(), {
      transports: ["websocket", "polling"],
      auth: token ? { token } : undefined,
      extraHeaders: token ? { Authorization: `Bearer ${token}` } : undefined,
      reconnection: false,
      timeout: 15000
    });

    const finish = (ok) => {
      try {
        socket.close();
      } catch {
        /* ignore */
      }
      resolve({ ok, ms: Date.now() - t0 });
    };

    socket.on("connect", () => finish(true));
    socket.on("connect_error", () => finish(false));
    setTimeout(() => {
      if (!socket.connected) finish(false);
    }, 16000);
  });

const started = Date.now();
const latencies = [];
let attempts = 0;
let successes = 0;
let failures = 0;

for (let cycle = 1; cycle <= cycles; cycle += 1) {
  const batch = await Promise.all(Array.from({ length: clients }, () => connectOnce()));
  for (const row of batch) {
    attempts += 1;
    if (row.ok) {
      successes += 1;
      latencies.push(row.ms);
    } else {
      failures += 1;
    }
  }
  console.log(
    `Cycle ${cycle}/${cycles}: ok=${batch.filter((r) => r.ok).length}/${clients} ` +
      `p95=${percentile(
        batch.filter((r) => r.ok).map((r) => r.ms),
        95
      )}ms`
  );
  if (cycle < cycles) await new Promise((r) => setTimeout(r, settleMs));
}

const availability = attempts ? successes / attempts : 0;
const passed = availability >= 0.995 && failures <= Math.max(1, Math.floor(attempts * 0.01));
const result = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  target: { url, namespace },
  config: { clients, cycles, settleMs },
  attempts,
  successes,
  failures,
  availability,
  connect: {
    p50Ms: percentile(latencies, 50),
    p95Ms: percentile(latencies, 95),
    passed
  },
  elapsedMs: Date.now() - started,
  passed
};

console.log(
  `Reconnect storm availability ${(availability * 100).toFixed(2)}% ` +
    `p50=${result.connect.p50Ms}ms p95=${result.connect.p95Ms}ms → ${passed ? "PASS" : "FAIL"}`
);

if (outputPath) {
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`Wrote machine-readable result to ${outputPath}`);
}

if (!passed) process.exitCode = 1;
