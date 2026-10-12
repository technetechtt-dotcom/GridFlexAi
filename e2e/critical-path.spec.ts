import { expect, test, type Page } from "@playwright/test";

type MockControl = {
  blockReadings: boolean;
};


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

const mockApi = async (page: Page): Promise<MockControl> => {
  const control: MockControl = { blockReadings: false };


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
          token: mockAccessToken
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

    if (path.endsWith("/api/operating-mode")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            mode: "SIMULATION",
            label: "Simulation",
            defaultTelemetryEnvironment: "simulation",
            liveNamespace: "/",
            simulationNamespace: "/simulation",
            liveTelemetryPath: "/api/v2/telemetry",
            simulationTelemetryPath: "/api/simulation/telemetry",
            simulationRunId: "e2e-sim-run",
            bannerTone: "blue"
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
              healthScore: 96,
              alerts: [],
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

    if (path.endsWith("/api/operator-decisions") && request.method() === "POST") {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            id: "decision-e2e-1",
            entityType: "forecast",
            entityId: "upington-node",
            title: "Forecast model review",
            decision: "model_review_requested",
            reason: "Operator opened controlled model-review workflow",
            createdAt: nowIso,
            actorName: "GridFlex Admin",
            actorRole: "admin"
          }
        })
      });
      return;
    }

    if (path.endsWith("/api/readings")) {
      if (control.blockReadings) {
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

    if (path.endsWith("/api/recovery/analyse")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            analysisMode: "advisory_only",
            algorithmVersion: "recovery-engine-e2e",
            dominantCause: "export_limit",
            causeLabel: "Export limit (synthetic demo)",
            confidence: 0.86,
            recommendation: "Prioritise flexible load absorption during the constrained window.",
            expectedEnergyKwh: 4200,
            actualEnergyKwh: 3366.25,
            lostEnergyKwh: 833.75,
            grossGapEnergyKwh: 900,
            performanceRatioPercent: 80.1,
            revenueAtRiskZar: 1875.94,
            carbonOpportunityKg: 708,
            affectedIntervals: 24,
            affectedDurationHours: 4,
            sampleCount: 48,
            windowDurationHours: 8,
            intervals: [],
            evidence: ["Synthetic competition scenario"],
            opportunities: [
              {
                id: "flexible_load",
                ranking: 1,
                label: "Flexible load",
                recoverableEnergyKwh: 420,
                estimatedGrossValueZar: 945,
                readiness: "demo_estimate",
                notes: "Illustrative only"
              }
            ],
            annualFinancialModel: {
              assumedEventDaysPerYear: 120,
              annualLostEnergyKwh: 100050,
              annualRevenueAtRiskZar: 225112.5,
              annualCarbonOpportunityKg: 84960,
              topOptionAnnualGrossValueZar: 113400,
              estimatedCapexZar: 2500000,
              simplePaybackYears: 22,
              notes: "Illustrative synthetic_demo sketch — not customer settlement."
            },
            provenance: {
              algorithmVersion: "recovery-engine-e2e",
              dataEnvironment: "synthetic_demo",
              sampleCount: 48,
              expectedSourceSummary: "weather-adjusted forecast",
              actualSourceSummary: "synthetic measured curve",
              qualitySummary: "valid synthetic samples",
              syntheticDemo: true
            },
            assumptions: {
              intervalMinutes: 10,
              tariffZarPerKwh: 2.25,
              flexibleLoadCapacityKw: 180,
              batteryUsableEnergyKwh: 300,
              electrolyserCapacityKw: 120,
              emissionFactorKgPerKwh: 0.85
            },
            disclaimer: "Advisory only. Physical execution disabled. Synthetic competition data."
          }
        })
      });
      return;
    }

    if (path.endsWith("/api/auth/sessions") || path.includes("/api/auth/login-history")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [] })
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [] })
    });
  });

  return control;
};

const openNavIfNeeded = async (page: Page) => {
  const open = page.getByRole("button", { name: "Open navigation menu" });
  if (await open.isVisible().catch(() => false)) {
    await open.click();
  }
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

  await openNavIfNeeded(page);
  await page.getByRole("button", { name: "Congestion", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Congestion Forecasting" })).toBeVisible();

  await page.getByRole("button", { name: "Compare vs Actual" }).click();
  await expect(page.getByRole("heading", { name: "Generation vs Forecast" })).toBeVisible();
});

test("dispatch retry banner recovers from transient API failure", async ({ page }) => {
  const control = await mockApi(page);
  await signIn(page);
  await expect(page.getByRole("heading", { name: "System Overview" })).toBeVisible();

  control.blockReadings = true;
  await openNavIfNeeded(page);
  await page.getByRole("button", { name: "Dispatch", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Dispatch Optimization" })).toBeVisible();
  await expect(page.getByText("Synthetic dispatch failure")).toBeVisible();

  const retry = page.getByRole("button", { name: "Retry sync" });
  await expect(retry).toBeVisible();
  control.blockReadings = false;
  await retry.click({ force: true }).catch(() => undefined);
  await expect(page.getByText("Synthetic dispatch failure")).toHaveCount(0, { timeout: 15000 });
  await expect(page.getByRole("heading", { name: "Advisory Dispatch Profile" })).toBeVisible();
});

test("unknown route shows page not found with path", async ({ page }) => {
  await mockApi(page);
  await signIn(page);
  await expect(page.getByRole("heading", { name: "System Overview" })).toBeVisible();

  // Client-side navigation only — full reload clears the SPA session under the 401 refresh mock.
  await page.evaluate(() => {
    window.history.pushState({}, "", "/this-route-does-not-exist");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await expect(page.getByText("/this-route-does-not-exist")).toBeVisible();
  await page.getByRole("link", { name: "Return to dashboard" }).click({ force: true });
  await expect(page.getByRole("heading", { name: "System Overview" })).toBeVisible();
});

test("settings icon opens account settings", async ({ page }) => {
  await mockApi(page);
  await signIn(page);
  await expect(page.getByRole("heading", { name: "System Overview" })).toBeVisible();

  await openNavIfNeeded(page);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Account settings" })).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole("heading", { name: "Profile summary" })).toBeVisible();
});

test("GCIP showcase presents the judge journey and safety state", async ({ page }) => {
  await mockApi(page);
  await signIn(page);
  await expect(page.getByRole("heading", { name: "System Overview" })).toBeVisible();

  await page.evaluate(() => {
    window.history.pushState({}, "", "/gcip");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(
    page.getByRole("heading", {
      name: "Recover renewable energy that South Africa already produces."
    })
  ).toBeVisible();
  await expect(page.getByText("Physical execution", { exact: true })).toBeVisible();
  await expect(page.getByText("Locked off", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Open the pilot case/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Six working demonstration steps/i })).toBeVisible();
});

test("GCIP showcase remains usable on a phone-sized screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockApi(page);
  await signIn(page);
  await expect(page.getByRole("heading", { name: "System Overview" })).toBeVisible();

  await page.evaluate(() => {
    window.history.pushState({}, "", "/gcip");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });

  await expect(
    page.getByRole("heading", {
      name: "Recover renewable energy that South Africa already produces."
    })
  ).toBeVisible();
  await expect(page.getByText("Safe competition mode")).toBeVisible();
  await expect(page.getByRole("button", { name: /Open the pilot case/i }).first()).toBeVisible();
});

test("GCIP presentation path reaches pilot case with lock messaging", async ({ page }) => {
  await mockApi(page);
  await signIn(page);
  await expect(page.getByRole("heading", { name: "System Overview" })).toBeVisible();

  await openNavIfNeeded(page);
  const demoSwitch = page.getByRole("switch");
  if ((await demoSwitch.getAttribute("aria-checked")) !== "true") {
    await demoSwitch.click();
  }
  await expect(page.getByRole("button", { name: "GCIP Showcase" })).toBeVisible();
  await page.getByRole("button", { name: "GCIP Showcase" }).click();
  await page.getByRole("button", { name: /Open the pilot case/i }).click();
  await expect(page.getByRole("heading", { name: /Pilot case evidence/i })).toBeVisible();
  await expect(
    page.getByText(/Physical plant execution remained locked|Physical execution/i).first()
  ).toBeVisible();
});

test("controls on congestion and generation pages are actionable", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Dense header actions covered on desktop chromium");
  await mockApi(page);
  await signIn(page);
  await expect(page.getByRole("heading", { name: "System Overview" })).toBeVisible();

  await page.evaluate(() => {
    window.history.pushState({}, "", "/congestion");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(page.getByRole("heading", { name: "Congestion Forecasting" })).toBeVisible();
  await page.getByRole("button", { name: "Next 72 Hours" }).click();
  await expect(page.getByText(/Switched to 72-hour/i)).toBeVisible();
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await expect(page.getByText(/CSV exported|Export unavailable/i).first()).toBeVisible();

  await page.getByRole("button", { name: "Compare vs Actual" }).click();
  await expect(page.getByRole("heading", { name: "Generation vs Forecast" })).toBeVisible();
  await page.getByRole("button", { name: "Request model review" }).click();
  await expect(
    page.getByText(/Opening model review workflow|Model review requested|Model review workflow/i).first()
  ).toBeVisible({ timeout: 15000 });
});

test("scenario reset and diagnostics controls work", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Scenario/diagnostics controls covered on desktop chromium");
  await mockApi(page);
  await signIn(page);
  await page.evaluate(() => {
    window.history.pushState({}, "", "/scenario");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(page.getByRole("heading", { name: /Scenario simulation/i })).toBeVisible();
  await page.getByRole("button", { name: "Reset" }).click();
  await expect(page.getByText(/Scenario controls reset/i)).toBeVisible();

  await page.evaluate(() => {
    window.history.pushState({}, "", "/diagnostics");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(page.getByRole("heading", { name: "Diagnostics results" })).toBeVisible();
  await page.getByRole("button", { name: "Run diagnostics" }).click();
  await expect(page.getByText(/Device connectivity|Last telemetry|Forecast providers/i).first()).toBeVisible();
});
