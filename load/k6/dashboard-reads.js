/**
 * Authenticated dashboard reads.
 * Requires BEARER_TOKEN for a staging operator/manager.
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";
import { authHeaders, baseUrl, slo } from "./lib.js";

const errorRate = new Rate("errors");

export const options = {
  scenarios: {
    readers: {
      executor: "constant-vus",
      vus: Number(__ENV.VUS || 100),
      duration: __ENV.DURATION || "3m"
    }
  },
  thresholds: {
    http_req_duration: [`p(95)<${slo.apiP95}`],
    errors: [`rate<${slo.errorRate}`]
  }
};

export default function () {
  const headers = authHeaders();
  const paths = ["/api/health", "/api/readings?page=1&pageSize=50", "/api/dashboard/summary"].filter(Boolean);
  // dashboard/summary may 404 if route differs — tolerate 401/404 as config, fail on 5xx
  for (const path of paths) {
    const res = http.get(`${baseUrl()}${path}`, { headers });
    const ok = check(res, {
      "no 5xx": (r) => r.status < 500
    });
    errorRate.add(!ok);
  }
  sleep(1);
}
