/**
 * Capture GCIP backup screenshots via Playwright (local preview).
 *
 *   npm run capture:gcip-screens
 */
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const outDir = path.resolve("go-live-reports", "gcip-screens");
const baseURL = process.env.BASE_URL || "http://127.0.0.1:4173";

const mockAccessToken = (() => {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      sub: "user-1",
      email: "admin@gridflex.ai",
      name: "GridFlex Admin",
      role: "admin",
      exp: Math.floor(Date.now() / 1000) + 3600
    })
  ).toString("base64url");
  return `${header}.${payload}.sig`;
})();

const mockApi = async (page) => {
  await page.route("**/api/**", async (route) => {
    const pathName = new URL(route.request().url()).pathname;
    if (pathName.endsWith("/api/auth/login")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: {
            id: "user-1",
            email: "admin@gridflex.ai",
            name: "GridFlex Admin",
            role: "admin"
          },
          token: mockAccessToken
        })
      });
      return;
    }
    if (pathName.endsWith("/api/auth/refresh")) {
      await route.fulfill({ status: 401, body: JSON.stringify({ message: "No refresh" }) });
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
            simulationRunId: "gcip-screen-capture",
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
            latestTimestamp: new Date().toISOString()
          }
        })
      });
      return;
    }
    if (pathName.endsWith("/api/forecast/providers/status")) {
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
};

const signIn = async (page) => {
  await page.goto(`${baseURL}/login`);
  await page.getByPlaceholder("operator@gridflex.ai").fill("admin@gridflex.ai");
  await page.getByPlaceholder("••••••••").first().fill("Admin@12345");
  await page.locator("form").getByRole("button", { name: "Sign In" }).click();
  await page.getByRole("heading", { name: "System Overview" }).waitFor({ timeout: 15000 });
};

const main = async () => {
  await fs.mkdir(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await mockApi(page);
  await signIn(page);
  await page.evaluate(() => {
    window.history.pushState({}, "", "/gcip");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await page.getByRole("heading", { name: /Recover renewable energy/i }).waitFor();
  await page.screenshot({ path: path.join(outDir, "01-gcip-hero-laptop.png"), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(outDir, "02-gcip-hero-phone.png"), fullPage: true });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("heading", { name: "One problem. Four clear steps." }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(outDir, "03-judge-steps.png"), fullPage: false });

  console.log(`Screenshots written to ${outDir}`);
  await browser.close();
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
