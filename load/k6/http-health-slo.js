import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";
import { baseUrl, slo } from "./lib.js";

const errorRate = new Rate("errors");
const latency = new Trend("health_latency", true);

export const options = {
  scenarios: {
    smoke: {
      executor: "constant-arrival-rate",
      rate: Number(__ENV.RATE || 20),
      timeUnit: "1s",
      duration: __ENV.DURATION || "1m",
      preAllocatedVUs: 20,
      maxVUs: 100
    }
  },
  thresholds: {
    http_req_failed: [`rate<${1 - Number(slo.availability)}`],
    http_req_duration: [`p(95)<${slo.apiP95}`],
    errors: [`rate<${slo.errorRate}`]
  }
};

export default function () {
  const res = http.get(`${baseUrl()}/api/health/live`);
  latency.add(res.timings.duration);
  const ok = check(res, { "status 200": (r) => r.status === 200 });
  errorRate.add(!ok);
  sleep(0.01);
}
