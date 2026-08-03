/**
 * Shared k6 helpers. Env:
 *   BASE_URL (required)
 *   BEARER_TOKEN (dashboard scenarios)
 *   DEVICE_ID, EDGE_SIGNATURE_MODE=skip|legacy (ingest — staging harness)
 *
 * Note: Full GRIDFLEX-V1 signing in k6 needs a precomputed harness or external
 * signer. Default sustained-ingest posts unsigned bodies to measure gateway
 * rejection rate under load, or set INGEST_PATH to a staging test double.
 */

export function baseUrl() {
  const u = __ENV.BASE_URL || __ENV.LOAD_BASE_URL || "http://localhost:4000";
  return u.replace(/\/$/, "");
}

export function authHeaders() {
  const token = __ENV.BEARER_TOKEN || "";
  const h = { "Content-Type": "application/json", Accept: "application/json" };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

export const slo = {
  // Override for hosted staging (Render free/starter often >500ms p95):
  //   API_P95_MS=2000 ERROR_RATE=0.05 AVAILABILITY=0.95
  apiP95: __ENV.API_P95_MS || "500",
  ingestP95: __ENV.INGEST_P95_MS || "300",
  errorRate: __ENV.ERROR_RATE || "0.01",
  availability: __ENV.AVAILABILITY || "0.995"
};
