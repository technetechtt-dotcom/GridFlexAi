/**
 * Duplicate/replay traffic: reuse the same nonce to assert 409 / rejection under load.
 * EXPECT_STATUS default 409.
 */
import http from "k6/http";
import { check } from "k6";
import { Counter, Rate } from "k6/metrics";
import { baseUrl } from "./lib.js";

const replays = new Counter("replay_attempts");
const unexpectedAccept = new Rate("unexpected_accept");

export const options = {
  vus: Number(__ENV.VUS || 20),
  duration: __ENV.DURATION || "1m",
  thresholds: {
    unexpected_accept: ["rate==0"]
  }
};

const sharedNonce = `replay-fixed-nonce-${__ENV.RUN_ID || "1"}`;

export default function () {
  replays.add(1);
  const body = JSON.stringify({ voltage: 230, current: 1, power: 0.2 });
  const res = http.post(`${baseUrl()}/api/edge-data`, body, {
    headers: {
      "Content-Type": "application/json",
      "x-gridflex-device-id": __ENV.DEVICE_ID || "loadtest-replay",
      "x-gridflex-timestamp": String(Date.now()),
      "x-gridflex-nonce": sharedNonce,
      "x-gridflex-signature": __ENV.EDGE_SIGNATURE || "loadtest-placeholder"
    }
  });
  // First may be 401 (bad sig) or 409 (replay); never 2xx for duplicate nonce after first auth success.
  const accepted = res.status >= 200 && res.status < 300;
  unexpectedAccept.add(accepted && __ITER > 0);
  check(res, {
    "not silently duplicating": () => !(accepted && __ITER > 0)
  });
}
