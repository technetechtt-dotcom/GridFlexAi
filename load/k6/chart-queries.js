/**
 * Historical chart / readings queries (large windows).
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate } from "k6/metrics";
import { authHeaders, baseUrl, slo } from "./lib.js";

const queryLatency = new Trend("chart_query_latency", true);
const errorRate = new Rate("errors");

export const options = {
  vus: Number(__ENV.VUS || 20),
  duration: __ENV.DURATION || "3m",
  thresholds: {
    chart_query_latency: [`p(95)<${Number(__ENV.CHART_P95_MS || 2000)}`],
    errors: [`rate<${slo.errorRate}`]
  }
};

export default function () {
  const end = new Date();
  const start = new Date(end.getTime() - 24 * 3600 * 1000);
  const url =
    `${baseUrl()}/api/readings?page=1&pageSize=200` +
    `&startDate=${encodeURIComponent(start.toISOString())}` +
    `&endDate=${encodeURIComponent(end.toISOString())}`;
  const res = http.get(url, { headers: authHeaders() });
  queryLatency.add(res.timings.duration);
  const ok = check(res, { "no 5xx": (r) => r.status < 500 });
  errorRate.add(!ok);
  sleep(0.5);
}
