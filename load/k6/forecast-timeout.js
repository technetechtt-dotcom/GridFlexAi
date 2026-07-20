/**
 * Forecast path under provider timeout / circuit pressure.
 * Hits forecast endpoint repeatedly; 4xx/5xx from missing keys are expected in some envs —
 * thresholds focus on not crashing the process (no connection resets).
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";
import { authHeaders, baseUrl } from "./lib.js";

const hardFail = new Rate("hard_fail");

export const options = {
  vus: Number(__ENV.VUS || 10),
  duration: __ENV.DURATION || "2m",
  thresholds: {
    hard_fail: ["rate<0.05"]
  }
};

export default function () {
  const url = `${baseUrl()}/api/forecast?lat=-26.2&lon=28.0&capacity=100`;
  const res = http.get(url, { headers: authHeaders(), timeout: "30s" });
  const ok = check(res, {
    "got response": (r) => r.status > 0
  });
  hardFail.add(!ok);
  sleep(1);
}
