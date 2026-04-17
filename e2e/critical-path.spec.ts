import { expect, test, type Page } from "@playwright/test";

type MockOptions = {
  failFirstReadingsRequest?: boolean;
};

const nowIso = "2026-04-17T09:00:00.000Z";

const makeForecastPayload = () => ({
  meta: {
    location: { lat: -28.4478, lon: 21.2561 },
    capacityKw: 220,
    tilt: 20,
    azimuth: 0,
    generatedAt: nowIso,
    cacheTtlMs: 2_700_000,
    dataSourcesUsed: ["forecast.solar", "openweathermap"],
    fallbackMessages: []
  },
  hourly: Array.from({ length: 24 }, (_, idx) => ({
    timestamp: new Date(Date.parse(nowIso) + idx * 60 * 60 * 1000).toISOString(),
    estimatedPowerKw: 120 + idx * 2,
    cloudCoverPct: 18,
    temperatureC: 24,
    irradianceWm2: 650,
    sources: ["forecast.solar", "openweathermap"]
  })),
  daily: [
    {
      date: "2026-04-17",
      estimatedEnergyKwh: 2_450,
      peakPowerKw: 178,
      avgCloudCoverPct: 22,
      avgTemperatureC: 25,
      sourceConfidence: "high",
      sources: ["forecast.solar", "openweathermap"]
    }
  ]
});

const makeReadings = () =>
  Array.from({ length: 12 }, (_, idx) => ({
    id: `reading-${idx + 1}`,
    nodeId: "upington-node",
    voltage: 132.1,
    current: 11.4,
    power: 120 + idx,
    energyToday: 450 + idx * 5,
    inverterPower: 118 + idx,
    curtailment: 0.4,
    timestamp: new Date(Date.parse(nowIso) - idx * 5 * 60 * 1000).toISOString(),
    node: {
      id: "upington-node",
      name: "Upington",
      location: "Northern Cape",
      status: "online"
    }
  }));

const mockApi = async (page: Page, options: MockOptions = {}) => {
  let readingsFailuresRemaining = options.failFirstReadingsRequest ? 1 : 0;

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (path.endsWith("/api/auth/refresh")) {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ message: "No refresh session" })
      });
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
          token: "mock-access-token"
        })
      });
      return;
    }

    if (path.endsWith("/api/auth/logout")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ message: "Logged out" })
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
            averages: {
              voltage: 132.1,
              current: 11.5,
              power: 132.7,
              inverterPower: 128.9,
              curtailment: 0.6
            },
            latestTimestamp: nowIso
          }
        })
      });
      return;
    }

    if (path.endsWith("/api/nodes")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [
            {
              id: "upington-node",
              name: "Upington",
              location: "Northern Cape",
              latitude: -28.4478,
              longitude: 21.2561,
              status: "online",
              lastSeen: nowIso,
              createdAt: "2026-01-01T00:00:00.000Z",
              lastReading: makeReadings()[0]
            }
          ]
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
            forecastSolar: { state: "closed", failures: 0, openedAt: null, nextAttemptInMs: 0 },
            openWeather: { state: "closed", failures: 0, openedAt: null, nextAttemptInMs: 0, configured: true },
            accuWeather: { state: "half-open", failures: 1, openedAt: nowIso, nextAttemptInMs: 3000, configured: true }
          },
          cache: {
            redisEnabled: true,
            redisConnected: true,
            inMemoryEntries: 3,
            ttlMs: 2_700_000
          }
        })
      });
      return;
    }

    if (path.endsWith("/api/forecast")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(makeForecastPayload())
      });
      return;
    }

    if (path.endsWith("/api/simulation/congestion-nodes")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [
            {
              name: "Upington",
              currentLoad: 64,
              forecast24h: [52, 55, 58, 62, 66, 70, 76, 81, 74, 69, 62, 58],
              risk: "medium"
            },
            {
              name: "De Aar",
              currentLoad: 57,
              forecast24h: [48, 51, 55, 60, 64, 68, 72, 75, 70, 66, 61, 56],
              risk: "low"
            }
          ]
        })
      });
      return;
    }

    if (path.endsWith("/api/simulation/dynamic-line-ratings")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [
            {
              corridor: "Northern Cape A",
              ambientTempC: 24,
              windSpeedMs: 5.3,
              staticLimitMW: 410,
              dynamicLimitMW: 472,
              upliftPercent: 15.1
            }
          ]
        })
      });
      return;
    }

    if (path.endsWith("/api/readings")) {
      if (readingsFailuresRemaining > 0) {
        readingsFailuresRemaining -= 1;
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ message: "Synthetic dispatch failure" })
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: makeReadings() })
      });
      return;
    }

    if (path.endsWith("/api/readings/summary")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [
            {
              nodeId: "upington-node",
              nodeName: "Upington",
              location: "Northern Cape",
              date: "2026-04-17",
              totalEnergyKwh: 820.4,
              avgPowerKw: 126.2,
              samples: 288
            }
          ]
        })
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: {} })
    });
  });
};

const signIn = async (page: Page) => {
  await page.goto("/login");
  await page.getByPlaceholder("operator@gridflex.ai").fill("admin@gridflex.ai");
  await page.getByPlaceholder("••••••••").first().fill("Admin@12345");
  await page.locator("form").getByRole("button", { name: "Sign In" }).click();
};

test("login reaches dashboard with provider status", async ({ page }) => {
  await mockApi(page);
  await signIn(page);

  await expect(page.getByRole("heading", { name: "System Overview" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Forecast Provider Health" })).toBeVisible();
  await expect(page.getByText("openweathermap", { exact: true })).toBeVisible();
});

test("forecast navigation path works after login", async ({ page }) => {
  await mockApi(page);
  await signIn(page);

  await page.getByRole("button", { name: "Congestion Forecast" }).click();
  await expect(page.getByRole("heading", { name: "Congestion Forecasting" })).toBeVisible();

  await page.getByRole("button", { name: "Compare vs Actual" }).click();
  await expect(page.getByRole("heading", { name: "Generation vs Forecast" })).toBeVisible();
});

test("dispatch retry banner recovers from transient API failure", async ({ page }) => {
  await mockApi(page, { failFirstReadingsRequest: true });
  await signIn(page);

  await page.getByRole("button", { name: "Dispatch Optimization" }).click();
  await expect(page.getByRole("heading", { name: "Dispatch Optimization" })).toBeVisible();
  await expect(page.getByText("Synthetic dispatch failure")).toBeVisible();

  await page.getByRole("button", { name: "Retry sync" }).click();
  await expect(page.getByText("Synthetic dispatch failure")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Generation & Dispatch Mix" })).toBeVisible();
});
