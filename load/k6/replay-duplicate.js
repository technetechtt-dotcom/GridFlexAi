/**
 * Duplicate/replay traffic: reuse the same nonce to assert 409 / rejection under load.
 * EXPECT_STATUS default 409.
 */
import http from "k6/http";
import { check } from "k6";
import { Counter, Rate } from "k6/metrics";
import crypto from "k6/crypto";
import encoding from "k6/encoding";
import { baseUrl } from "./lib.js";

const replays = new Counter("replay_attempts");
const acceptedRequests = new Counter("accepted_requests");
const unexpectedAccept = new Rate("unexpected_accept");

export const options = {
  vus: Number(__ENV.VUS || 20),
  duration: __ENV.DURATION || "1m",
  thresholds: {
    unexpected_accept: ["rate==0"],
    accepted_requests: ["count<=1"]
  }
};

export function setup() {
  const deviceId = __ENV.DEVICE_ID || "";
  const credentialId = __ENV.DEVICE_CREDENTIAL_ID || "";
  const secretB64Url = __ENV.DEVICE_SECRET_B64URL || "";
  const keyVersion = Number(__ENV.DEVICE_KEY_VERSION || "1");
  const sequenceNumber = Number(__ENV.SEQUENCE_NUMBER || "900000000");
  if (!deviceId || !credentialId || !secretB64Url) {
    throw new Error(
      "Replay validation requires DEVICE_ID, DEVICE_CREDENTIAL_ID and DEVICE_SECRET_B64URL."
    );
  }

  const timestamp = String(Date.now());
  const nonce = `replay-fixed-${__ENV.RUN_ID || timestamp}`;
  const body = JSON.stringify({
    voltage: 230,
    current: 1,
    power: 0.2,
    timestamp: new Date(Number(timestamp)).toISOString()
  });
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
  const signature = crypto.hmac(
    "sha256",
    encoding.b64decode(secretB64Url, "rawurl"),
    canonical,
    "base64rawurl"
  );

  return {
    body,
    headers: {
      "Content-Type": "application/json",
      "x-gridflex-device-id": deviceId,
      "x-gridflex-credential-id": credentialId,
      "x-gridflex-key-version": String(keyVersion),
      "x-gridflex-sequence-number": String(sequenceNumber),
      "x-gridflex-timestamp": timestamp,
      "x-gridflex-nonce": nonce,
      "x-gridflex-signature": signature
    }
  };
}

export default function (request) {
  replays.add(1);
  const res = http.post(`${baseUrl()}/api/edge-data`, request.body, {
    headers: request.headers
  });
  const accepted = res.status >= 200 && res.status < 300;
  if (accepted) acceptedRequests.add(1);
  unexpectedAccept.add(accepted && __ITER > 0);
  check(res, {
    "initial request accepted or replay rejected": (r) =>
      (r.status >= 200 && r.status < 300) || r.status === 409,
    "not silently duplicating": () => !(accepted && __ITER > 0)
  });
}
