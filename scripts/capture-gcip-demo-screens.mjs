#!/usr/bin/env node
/**
 * Capture GCIP demonstration screenshots as a backup when live demo risk is high.
 *
 * Usage:
 *   BASE_URL=http://127.0.0.1:4173 node scripts/capture-gcip-demo-screens.mjs
 *
 * After mocked sign-in, routes use client-side history (pushState) so a 401
 * refresh mock does not wipe the SPA session on full reload.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = (process.env.BASE_URL || "http://127.0.0.1:4173").replace(/\/$/, "");
const outDir = path.resolve("docs/competition/evidence/screens");
const routes = [
  { route: "/login", auth: false, fullGoto: true },
  { route: "/gcip?demo=1", auth: true },
  { route: "/pilot-case", auth: true },
  { route: "/climate-impact", auth: true },
  { route: "/commercial-value", auth: true },
  { route: "/ai-evidence", auth: true }
];

const nowIso = "2026-04-17T09:00:00.000Z";
const mockAccessToken = (() => {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      sub: "user-1",
      email: "admin@gridflex.ai",
      name: "GridFlex Admin",
      role: "admin",
      exp: Math.floor(Date.now() / 1000) + 60 * 60
    })
  ).toString("base64url");
  return `${header}.${payload}.sig`;
})();

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.route("**/api/**", async (route) => {
  const pathName = new URL(route.request().url()).pathname;
  if (pathName.endsWith("/api/auth/refresh")) {
    await route.fulfill({ status: 401, body: JSON.stringify({ message: "No refresh" }) });
    return;
  }
  if (pathName.endsWith("/api/auth/login")) {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: {
          id: "user-1",
          email: "admin@gridflex.ai",
          name: "GridFlex Admin",
          role: "admin",
          lastLoginAt: nowIso,
          createdAt: "2026-01-01T00:00:00.000Z"
        },
        token: mockAccessToken
      })
    });
    return;
  }
  if (pathName.endsWith("/api/operating-mode")) {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          mode: "SIMULATION",
          label: "Simulation",
          bannerTone: "blue",
          simulationRunId: "capture-sim-run",
          liveTelemetryPath: "/api/v2/telemetry",
          simulationTelemetryPath: "/api/simulation/telemetry"
        }
      })
    });
    return;
  }
  if (pathName.endsWith("/api/dashboard/summary")) {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          nodes: { total: 3, online: 3, offline: 0 },
          readingsWindow: 120,
          averages: { voltage: 132, current: 11, power: 130, inverterPower: 128, curtailment: 0.5 },
          latestTimestamp: nowIso
        }
      })
    });
    return;
  }
  if (pathName.includes("/api/forecast/providers/status")) {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        providers: {
          forecastSolar: { state: "closed", failures: 0 },
          openWeather: { state: "closed", failures: 0, configured: true },
          accuWeather: { state: "closed", failures: 0, configured: true }
        },
        cache: { redisEnabled: true, redisConnected: true, inMemoryEntries: 1, ttlMs: 1000 }
      })
    });
    return;
  }
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ data: [] })
  });
});

let signedIn = false;
async function ensureSignedIn() {
  if (signedIn) return;
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByPlaceholder("operator@gridflex.ai").fill("admin@gridflex.ai");
  await page.getByPlaceholder("••••••••").first().fill("Admin@12345");
  await page.locator("form").getByRole("button", { name: /Sign In/i }).click();
  await page.getByRole("heading", { name: "System Overview" }).waitFor({ timeout: 45_000 });
  signedIn = true;
}

async function goRoute(route, { fullGoto = false } = {}) {
  if (fullGoto || !signedIn) {
    await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    return;
  }
  await page.evaluate((next) => {
    window.history.pushState({}, "", next);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, route);
}

const manifest = [];
for (const { route, auth, fullGoto } of routes) {
  try {
    if (auth) await ensureSignedIn();
    await goRoute(route, { fullGoto: Boolean(fullGoto) });
    await page.waitForTimeout(1500);
    const safe = route.replace(/[^\w.-]+/g, "_").replace(/^_/, "");
    const file = path.join(outDir, `${safe || "root"}.png`);
    await page.screenshot({ path: file, fullPage: true });
    manifest.push({ route, file, ok: true });
    console.log(`OK ${route} → ${file}`);
  } catch (error) {
    manifest.push({
      route,
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    });
    console.error(`FAIL ${route}: ${error instanceof Error ? error.message : error}`);
  }
}

await browser.close();
await writeFile(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
const failed = manifest.filter((m) => !m.ok).length;
if (failed) {
  console.error(`${failed} screenshot(s) failed.`);
  process.exitCode = 1;
} else {
  console.log(`Captured ${manifest.length} screens under ${outDir}`);
}
