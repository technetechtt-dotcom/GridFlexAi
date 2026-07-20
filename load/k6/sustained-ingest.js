/**
 * Sustained edge ingestion at configurable arrival rate (default 60 rps ≈ 3× of 20).
 *
 * For authorized staging with a test ingest harness, set:
 *   INGEST_PATH=/api/edge-data
 *   DEVICE_ID=...
 *   X_GRIDFLEX_* headers via PRECOMPUTED_HEADERS_JSON if using signed fixtures
 *
 * Without signatures, expect 401 — use this mode only to validate rate-limit /
 * gateway behaviour, not acceptance SLOs. Set EXPECT_STATUS=401 in that case.
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";
import { baseUrl, slo } from "./lib.js";

const ingestLatency = new Trend("ingest_latency", true);
const errorRate = new Rate("errors");
const expectStatus = Number(__ENV.EXPECT_STATUS || 201);

export const options = {
  scenarios: {
    sustained: {
      executor: "constant-arrival-rate",
      rate: Number(__ENV.INGEST_RPS || 60),
      timeUnit: "1s",
      duration: __ENV.DURATION || "5m",
      preAllocatedVUs: 50,
      maxVUs: Number(__ENV.MAX_VUS || 200)
    }
  },
  thresholds: {
    ingest_latency: [`p(95)<${slo.ingestP95}`],
    errors: [`rate<${slo.errorRate}`]
  }
};

export default function () {
  const path = __ENV.INGEST_PATH || "/api/edge-data";
  const deviceId = __ENV.DEVICE_ID || "loadtest-device";
  const body = JSON.stringify({
    voltage: 230 + Math.random(),
    current: 10 + Math.random(),
    power: 2 + Math.random(),
    timestamp: new Date().toISOString()
  });

  const headers = {
    "Content-Type": "application/json",
    "x-gridflex-device-id": deviceId,
    "x-gridflex-timestamp": String(Date.now()),
    "x-gridflex-nonce": `${__VU}-${__ITER}-${Date.now()}`,
    "x-gridflex-signature": __ENV.EDGE_SIGNATURE || "loadtest-placeholder"
  };

  const res = http.post(`${baseUrl()}${path}`, body, { headers });
  ingestLatency.add(res.timings.duration);
  const ok = check(res, {
    [`status ${expectStatus}`]: (r) => r.status === expectStatus
  });
  errorRate.add(!ok);
  sleep(0.001);
}
