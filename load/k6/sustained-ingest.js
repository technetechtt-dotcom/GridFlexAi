/**
 * Sustained edge ingestion at configurable arrival rate (default 60 rps ≈ 3× of 20).
 *
 * For authorized staging with a test ingest harness, set:
 *   INGEST_PATH=/api/edge-data
 *   DEVICE_ID=...
 *   DEVICE_CREDENTIAL_ID, DEVICE_KEY_VERSION, and DEVICE_SECRET_B64URL
 *
 * Without signatures, expect 401 — use this mode only to validate rate-limit /
 * gateway behaviour, not acceptance SLOs. Set EXPECT_STATUS=401 in that case.
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";
import crypto from "k6/crypto";
import encoding from "k6/encoding";
import { baseUrl, slo } from "./lib.js";

const ingestLatency = new Trend("ingest_latency", true);
const errorRate = new Rate("errors");
const expectStatus = Number(__ENV.EXPECT_STATUS || 201);
const credentialId = __ENV.DEVICE_CREDENTIAL_ID || "";
const keyVersion = Number(__ENV.DEVICE_KEY_VERSION || "1");
const secretB64Url = __ENV.DEVICE_SECRET_B64URL || "";

if (expectStatus >= 200 && expectStatus < 300 && (!credentialId || !secretB64Url)) {
  throw new Error(
    "Accepted-ingest load tests require DEVICE_CREDENTIAL_ID and DEVICE_SECRET_B64URL."
  );
}

const scenario =
  __ENV.INGEST_PROFILE === "burst"
    ? {
        executor: "ramping-arrival-rate",
        startRate: Number(__ENV.START_RPS || "10"),
        timeUnit: "1s",
        preAllocatedVUs: 100,
        maxVUs: Number(__ENV.MAX_VUS || 500),
        stages: [
          { duration: __ENV.RAMP_UP || "30s", target: Number(__ENV.INGEST_RPS || 300) },
          { duration: __ENV.HOLD || "1m", target: Number(__ENV.INGEST_RPS || 300) },
          { duration: __ENV.RAMP_DOWN || "30s", target: Number(__ENV.END_RPS || 20) }
        ]
      }
    : {
      executor: "constant-arrival-rate",
      rate: Number(__ENV.INGEST_RPS || 60),
      timeUnit: "1s",
      duration: __ENV.DURATION || "5m",
      preAllocatedVUs: Number(__ENV.PREALLOCATED_VUS || 50),
      maxVUs: Number(__ENV.MAX_VUS || 200)
    };

export const options = {
  scenarios: {
    ingest: scenario
  },
  thresholds: {
    ingest_latency: [`p(95)<${__ENV.INGEST_P95_MS || slo.ingestP95}`],
    errors: [`rate<${__ENV.INGEST_ERROR_RATE || slo.errorRate}`]
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
  const timestamp = String(Date.now());
  const nonce = `${__VU}-${__ITER}-${timestamp}`;
  // Watermark is BIGINT — values may exceed INT4 (2^31-1); keep monotonic per VU.
  const sequenceNumber =
    Number(__ENV.SEQUENCE_BASE || "100000") + __VU * 100000 + __ITER;
  const bodyHash = crypto.sha256(body, "hex");
  const canonical = [
    "GRIDFLEX-V1",
    deviceId,
    credentialId,
    String(keyVersion),
    timestamp,
    nonce,
    String(sequenceNumber),
    bodyHash
  ].join("\n");
  const signature = secretB64Url
    ? crypto.hmac(
        "sha256",
        encoding.b64decode(secretB64Url, "rawurl"),
        canonical,
        "base64rawurl"
      )
    : (__ENV.EDGE_SIGNATURE || "loadtest-placeholder");

  const headers = {
    "Content-Type": "application/json",
    "x-gridflex-device-id": deviceId,
    "x-gridflex-timestamp": timestamp,
    "x-gridflex-nonce": nonce,
    "x-gridflex-signature": signature,
    ...(credentialId
      ? {
          "x-gridflex-credential-id": credentialId,
          "x-gridflex-key-version": String(keyVersion),
          "x-gridflex-sequence-number": String(sequenceNumber)
        }
      : {})
  };

  const res = http.post(`${baseUrl()}${path}`, body, { headers });
  ingestLatency.add(res.timings.duration);
  const ok = check(res, {
    [`status ${expectStatus}`]: (r) => r.status === expectStatus
  });
  errorRate.add(!ok);
  sleep(0.001);
}
