/**
 * Authenticated HTTP smoke against an isolated restore-target backend.
 * Intended for local NODE_ENV=development pointed at a Neon restore branch.
 *
 * Guard: RESTORE_HTTP_SMOKE_ALLOW=true
 * Does not require HTTPS/Secure cookies (unlike production go-live verifier).
 *
 * Usage:
 *   RESTORE_HTTP_SMOKE_ALLOW=true \
 *   RESTORE_SMOKE_BASE_URL=http://127.0.0.1:4010 \
 *   RESTORE_SMOKE_EMAIL=admin@gridflex.ai \
 *   RESTORE_SMOKE_PASSWORD=... \
 *   node scripts/restore-http-smoke.mjs
 */
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

if (process.env.RESTORE_HTTP_SMOKE_ALLOW !== "true") {
  console.error("Refusing to run without RESTORE_HTTP_SMOKE_ALLOW=true");
  process.exit(2);
}

const baseUrl = process.env.RESTORE_SMOKE_BASE_URL ?? "http://127.0.0.1:4010";
const email = process.env.RESTORE_SMOKE_EMAIL ?? "";
const password = process.env.RESTORE_SMOKE_PASSWORD ?? "";
const outputFile =
  process.env.RESTORE_SMOKE_OUTPUT_FILE ??
  path.join("go-live-reports", "restore-http-smoke.json");

if (!email || !password) {
  console.error("RESTORE_SMOKE_EMAIL and RESTORE_SMOKE_PASSWORD are required.");
  process.exit(2);
}

const parsed = new URL(baseUrl);
if (!["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname)) {
  console.error("Restore HTTP smoke only allows loopback hosts.");
  process.exit(2);
}

const checks = [];

const record = (name, ok, detail = {}) => {
  checks.push({ name, ok, ...detail });
  if (!ok) {
    throw new Error(`${name} failed: ${JSON.stringify(detail)}`);
  }
};

const request = async (name, pathname, options = {}, expectedStatus) => {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  const bodyText = await response.text();
  const ok = response.status === expectedStatus;
  const redactedPreview = bodyText
    .replace(/"token"\s*:\s*"[^"]+"/g, '"token":"[REDACTED]"')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [REDACTED]")
    .slice(0, 240);
  record(name, ok, {
    path: pathname,
    expectedStatus,
    actualStatus: response.status,
    bodyPreview: redactedPreview
  });
  return { response, bodyText };
};

const extractCookie = (setCookieHeader, name) => {
  if (!setCookieHeader) return null;
  const parts = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  for (const part of parts) {
    const match = part.match(new RegExp(`${name}=([^;]+)`));
    if (match) return { value: match[1], raw: part };
  }
  return null;
};

const main = async () => {
  await request("liveness", "/api/health/live", {}, 200);
  const health = await request("health", "/api/health", {}, 200);
  const healthJson = JSON.parse(health.bodyText);
  record("health.status", healthJson.status === "ok", { status: healthJson.status });

  await request("auth guard", "/api/nodes", {}, 401);

  const login = await request(
    "login",
    "/api/auth/login",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    },
    200
  );
  const loginJson = JSON.parse(login.bodyText);
  record("login.token", typeof loginJson.token === "string" && loginJson.token.length > 20);
  record("login.noRefreshLeak", !("refreshToken" in loginJson));

  const setCookie = login.response.headers.getSetCookie?.() ?? [];
  const cookieHeader = login.response.headers.get("set-cookie");
  const refresh = extractCookie(
    setCookie.length ? setCookie : cookieHeader,
    "gridflex_refresh_token"
  );
  record("login.refreshCookie", Boolean(refresh?.value), {
    httpOnly: /httponly/i.test(refresh?.raw ?? ""),
    path: /path=\/api\/auth/i.test(refresh?.raw ?? "")
  });

  const authHeaders = { Authorization: `Bearer ${loginJson.token}` };
  await request("authenticated nodes", "/api/nodes", { headers: authHeaders }, 200);
  await request("authenticated readings", "/api/readings?limit=5&sort=desc", { headers: authHeaders }, 200);
  await request(
    "dashboard summary",
    "/api/dashboard/summary",
    { headers: authHeaders },
    200
  );

  if (refresh?.value) {
    const refreshResult = await request(
      "refresh cookie rotation",
      "/api/auth/refresh",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `gridflex_refresh_token=${refresh.value}`
        },
        body: "{}"
      },
      200
    );
    const refreshed = JSON.parse(refreshResult.bodyText);
    record("refresh.token", typeof refreshed.token === "string");
    record("refresh.noRefreshLeak", !("refreshToken" in refreshed));
  }

  await fs.mkdir(path.dirname(outputFile), { recursive: true });
  const payload = {
    mode: "restore-http-smoke",
    baseUrl,
    email,
    generatedAt: new Date().toISOString(),
    commitSha: process.env.GIT_COMMIT_SHA ?? null,
    neonBranch: process.env.RESTORE_SMOKE_NEON_BRANCH ?? null,
    checks
  };
  const json = `${JSON.stringify(payload, null, 2)}\n`;
  await fs.writeFile(outputFile, json, "utf8");
  const sha256 = crypto.createHash("sha256").update(json).digest("hex");
  await fs.writeFile(`${outputFile}.sha256`, `${sha256}  ${path.basename(outputFile)}\n`, "utf8");

  console.log(`Restore HTTP smoke passed against ${baseUrl}`);
  console.log(`Report: ${outputFile}`);
  console.log(`SHA-256: ${sha256}`);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
