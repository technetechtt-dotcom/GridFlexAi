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
// Each worker models one device. Sharing a credential races its sequence watermark.
const devices = __ENV.DEVICE_CREDENTIALS_FILE
  ? JSON.parse(open(__ENV.DEVICE_CREDENTIALS_FILE))
  : [{ deviceId: __ENV.DEVICE_ID, credentialId, secretB64Url, keyVersion,
      sequenceBase: Number(__ENV.SEQUENCE_BASE || "100000") }];
if (!Array.isArray(devices) || devices.length === 0) throw new Error("Device credential list must not be empty.");
const acceptedMode = expectStatus >= 200 && expectStatus < 300;
if (acceptedMode && devices.some((device) => !device.deviceId || !device.credentialId || !device.secretB64Url)) {
  throw new Error("Every worker requires a dedicated device and credential.");
}
if (new Set(devices.map((device) => device.credentialId)).size !== devices.length ||
    new Set(devices.map((device) => device.deviceId)).size !== devices.length) {
  throw new Error("Workers must use unique devices and credentials.");
}
const maxVUs = Number(__ENV.MAX_VUS || devices.length);
if (acceptedMode && maxVUs > devices.length) throw new Error("MAX_VUS exceeds the number of dedicated device credentials.");

if (acceptedMode && !__ENV.DEVICE_CREDENTIALS_FILE && (!credentialId || !secretB64Url)) {
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
        preAllocatedVUs: Number(__ENV.PREALLOCATED_VUS || maxVUs),
        maxVUs,
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
      preAllocatedVUs: Number(__ENV.PREALLOCATED_VUS || maxVUs),
      maxVUs
    };

export const options = {
  scenarios: {
    ingest: scenario
  },
  thresholds: {
    dropped_iterations: ["count==0"],
    ingest_latency: [`p(95)<${__ENV.INGEST_P95_MS || slo.ingestP95}`],
    errors: [`rate<${__ENV.INGEST_ERROR_RATE || slo.errorRate}`]
  }
};

export default function () {
  const path = __ENV.INGEST_PATH || "/api/edge-data";
  const device = devices[__VU - 1];
  const deviceId = device?.deviceId || "loadtest-device";
  const workerCredentialId = device?.credentialId || credentialId;
  const workerKeyVersion = device?.keyVersion || keyVersion;
  const workerSecret = device?.secretB64Url || secretB64Url;
  const body = JSON.stringify({
    voltage: 230 + Math.random(),
    current: 10 + Math.random(),
    power: 2 + Math.random(),
    timestamp: new Date().toISOString()
  });
  const timestamp = String(Date.now());
  const nonce = `${__VU}-${__ITER}-${timestamp}`;
  // Watermark is BIGINT — values may exceed INT4 (2^31-1); keep monotonic per VU.
  const sequenceNumber = Number(device?.sequenceBase ?? __ENV.SEQUENCE_BASE ?? "100000") + __ITER;
  if (!Number.isSafeInteger(sequenceNumber) || sequenceNumber < 0) throw new Error("Invalid sequence base.");
  const bodyHash = crypto.sha256(body, "hex");
  const canonical = [
    "GRIDFLEX-V1",
    deviceId,
    workerCredentialId,
    String(workerKeyVersion),
    timestamp,
    nonce,
    String(sequenceNumber),
    bodyHash
  ].join("\n");
  const signature = workerSecret
    ? crypto.hmac(
        "sha256",
        encoding.b64decode(workerSecret, "rawurl"),
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
    ...(workerCredentialId
      ? {
          "x-gridflex-credential-id": workerCredentialId,
          "x-gridflex-key-version": String(workerKeyVersion),
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
