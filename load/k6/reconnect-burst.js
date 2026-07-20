/**
 * Reconnect burst: many VUs briefly hammer auth/ingest as if nodes reconnected.
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";
import { baseUrl } from "./lib.js";

const errorRate = new Rate("errors");

export const options = {
  scenarios: {
    burst: {
      executor: "ramping-arrival-rate",
      startRate: 10,
      timeUnit: "1s",
      preAllocatedVUs: 100,
      maxVUs: Number(__ENV.MAX_VUS || 500),
      stages: [
        { duration: "20s", target: Number(__ENV.BURST_RPS || 300) },
        { duration: "30s", target: Number(__ENV.BURST_RPS || 300) },
        { duration: "20s", target: 20 }
      ]
    }
  },
  thresholds: {
    http_req_failed: ["rate<0.05"],
    errors: ["rate<0.05"]
  }
};

export default function () {
  const res = http.get(`${baseUrl()}/api/health`);
  const ok = check(res, { "health ok or degraded": (r) => r.status === 200 || r.status === 503 });
  errorRate.add(!ok);
  sleep(0.05);
}
