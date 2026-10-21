#!/usr/bin/env node
/**
 * Smoke-test protected SPA routes and API health for broken links / auth gates.
 *
 * Usage:
 *   BASE_URL=https://gridflexai.onrender.com API_URL=https://gridflex-backend.onrender.com node scripts/test-protected-routes.mjs
 */
const baseUrl = (process.env.BASE_URL || "http://localhost:5173").replace(/\/$/, "");
const apiUrl = (process.env.API_URL || process.env.VITE_SOCKET_BASE_URL || "http://localhost:4000").replace(
  /\/$/,
  ""
);

const SPA_ROUTES = [
  "/",
  "/login",
  "/plants",
  "/nodes",
  "/alarms",
  "/approvals",
  "/diagnostics",
  "/recovery",
  "/recovery/cases",
  "/operator-tasks",
  "/reports",
  "/pilot-onboarding",
  "/data-quality",
  "/pilot-results",
  "/settings",
  "/help",
  "/gcip",
  "/pilot-case",
  "/climate-impact",
  "/commercial-value",
  "/ai-evidence",
  "/dispatch",
  "/scenario",
  "/ai"
];

const API_ROUTES = ["/api/health/live", "/api/health", "/api/operating-mode"];

const results = [];

async function check(url, expectOk = true) {
  try {
    const res = await fetch(url, { redirect: "manual" });
    const ok = expectOk ? res.status >= 200 && res.status < 400 : res.status === 401 || res.status === 403;
    results.push({ url, status: res.status, ok });
    return ok;
  } catch (error) {
    results.push({ url, status: 0, ok: false, error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}

let failed = 0;
for (const path of SPA_ROUTES) {
  const ok = await check(`${baseUrl}${path}`);
  if (!ok) failed += 1;
}

for (const path of API_ROUTES) {
  const ok = await check(`${apiUrl}${path}`);
  if (!ok) failed += 1;
}

// Unauthenticated API should deny protected resources
for (const path of ["/api/alarm-events", "/api/work-orders", "/api/data-quality", "/api/pilot-onboarding"]) {
  const ok = await check(`${apiUrl}${path}`, false);
  if (!ok) failed += 1;
}

for (const row of results) {
  const mark = row.ok ? "PASS" : "FAIL";
  console.log(`${mark} ${row.status} ${row.url}${row.error ? ` (${row.error})` : ""}`);
}

if (failed > 0) {
  console.error(`\n${failed} route check(s) failed.`);
  process.exit(1);
}

console.log(`\nAll ${results.length} route checks passed.`);
