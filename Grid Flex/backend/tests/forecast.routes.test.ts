import request from "supertest";

jest.mock("../src/middleware/auth.js", () => ({
  authenticate: (_req: unknown, _res: unknown, next: () => void) => next(),
  authorizeRoles: () => (_req: unknown, _res: unknown, next: () => void) => next()
}));

import { createApp } from "../src/app.js";
import { getDailyForecastPredictions, getForecastDebug, getForecastProvidersHistory, getForecastProvidersStatus, getHybridForecast } from "../src/services/forecast.service.js";

jest.mock("../src/services/forecast.service.js", () => ({
  getHybridForecast: jest.fn(),
  getDailyForecastPredictions: jest.fn(),
  getForecastProvidersStatus: jest.fn(),
  getForecastProvidersHistory: jest.fn(),
  getForecastDebug: jest.fn()
}));

const mockedForecast = getHybridForecast as jest.MockedFunction<typeof getHybridForecast>;
const mockedDailyPredictions = getDailyForecastPredictions as jest.MockedFunction<typeof getDailyForecastPredictions>;
const mockedProviderStatus = getForecastProvidersStatus as jest.MockedFunction<typeof getForecastProvidersStatus>;
const mockedProviderHistory = getForecastProvidersHistory as jest.MockedFunction<typeof getForecastProvidersHistory>;
const mockedForecastDebug = getForecastDebug as jest.MockedFunction<typeof getForecastDebug>;

describe("Forecast routes", () => {
  const app = createApp();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns forecast payload", async () => {
    mockedForecast.mockResolvedValue({
      meta: {
        location: {
          lat: -28.4478,
          lon: 21.2561
        },
        capacityKw: 120,
        tilt: 20,
        azimuth: 0,
        generatedAt: new Date().toISOString(),
        cacheTtlMs: 2700000,
        dataSourcesUsed: ["forecast.solar"],
        fallbackMessages: []
      },
      hourly: [],
      daily: [],
    } as Awaited<ReturnType<typeof getHybridForecast>>);

    const res = await request(app)
    .get("/api/forecast")
    .query({
      lat: -28.4478,
      lon: 21.2561,
      capacity: 120
    });

    expect(res.status).toBe(200);
    expect(res.body.meta.location.lat).toBe(-28.4478);
  });

  it("validates required forecast query params", async () => {
    const res = await request(app).get("/api/forecast");
    expect(res.status).toBe(400);
  });

  it("returns debug payload", async () => {
    mockedForecastDebug.mockReturnValue({
      generatedAt: new Date().toISOString(),
      cache: {
        lastHitSource: "memory",
        redisEnabled: true,
        redisConnected: true,
        inMemoryEntries: 1,
        ttlMs: 2700000
      },
      forecast: {
        lastGeneratedAt: new Date().toISOString(),
        responseAgeMs: 0
      },
      providers: {
        forecastSolar: {
          latencyMs: 120,
          lastOutcome: "ok",
          lastError: null,
          updatedAt: new Date().toISOString()
        },
        openWeather: {
          latencyMs: null,
          lastOutcome: "not-configured",
          lastError: null,
          updatedAt: null,
          configured: false
        },
        accuWeather: {
          latencyMs: null,
          lastOutcome: "not-configured",
          lastError: null,
          updatedAt: null,
          configured: false
        }
      }
    });

    const res = await request(app)
    .get("/api/forecast/debug");

    expect(res.status).toBe(200);
    expect(res.body.providers.forecastSolar.lastOutcome).toBe("ok");
  });

  it("returns stored daily prediction history", async () => {
    mockedDailyPredictions.mockResolvedValue({
      data: [{
        id: "pred-1",
        nodeId: "node-1",
        nodeName: "Upington Node",
        location: "Upington",
        forecastDate: new Date().toISOString(),
        estimatedEnergyKwh: 780.2,
        peakPowerKw: 132.4,
        sourceConfidence: "medium",
        generatedAt: new Date().toISOString()
      }],
      pagination: {
        page: 1,
        pageSize: 30,
        total: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false
      }
    });

    const res = await request(app)
    .get("/api/forecast/daily-predictions")
    .query({
      page: 1,
      pageSize: 30
    });

    expect(res.status).toBe(200);
    expect(res.body.data[0].nodeId).toBe("node-1");
  });
});
