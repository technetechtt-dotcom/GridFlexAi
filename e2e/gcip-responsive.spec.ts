import { expect, test, type Page } from "@playwright/test";

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

const mockApi = async (page: Page) => {
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/api/auth/refresh")) {
      await route.fulfill({ status: 401, body: JSON.stringify({ message: "No refresh" }) });
      return;
    }
    if (path.endsWith("/api/auth/login")) {
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
    if (path.endsWith("/api/operating-mode")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            mode: "SIMULATION",
            label: "Simulation",
            bannerTone: "blue",
            simulationRunId: "e2e-sim-run",
            liveTelemetryPath: "/api/v2/telemetry",
            simulationTelemetryPath: "/api/simulation/telemetry"
          }
        })
      });
      return;
    }
    if (path.endsWith("/api/dashboard/summary")) {
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
    if (path.endsWith("/api/forecast/providers/status")) {
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

const signIn = async (page: Page) => {
  await page.goto("/login");
  await page.getByPlaceholder("operator@gridflex.ai").fill("admin@gridflex.ai");
  await page.getByPlaceholder("••••••••").first().fill("Admin@12345");
  await page.locator("form").getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "System Overview" })).toBeVisible();
};

test("GCIP showcase is usable on constrained viewports", async ({ page }) => {
  await mockApi(page);
  await signIn(page);
  await page.evaluate(() => {
    window.history.pushState({}, "", "/gcip");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(
    page.getByRole("heading", {
      name: "Recover renewable energy that South Africa already produces."
    })
  ).toBeVisible();
  await expect(page.getByText("Locked off", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Start demonstration/i }).first()).toBeVisible();
});
