import NodeCache from "node-cache";

import { DEFAULT_FORECAST_AZIMUTH, DEFAULT_FORECAST_TILT, FORECAST_CACHE_TTL_MS } from "../config/constants.js";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { getRedisClient } from "../lib/redis.js";
import { AppError } from "../utils/AppError.js";
import { CircuitBreaker } from "../utils/circuitBreaker.js";

type ForecastParams = {
  lat: number;
  lon: number;
  capacity: number;
  tilt?: number;
  azimuth?: number;
};

type ProviderState = "closed" | "open" | "half-open";
type CacheHitSource = "memory" | "redis" | "miss";

type UnifiedHourlyForecast = {
  timestamp: string;
  estimatedPowerKw: number;
  cloudCoverPct: number | null;
  temperatureC: number | null;
  irradianceWm2: number | null;
  sources: string[];
};

type UnifiedDailyForecast = {
  date: string;
  estimatedEnergyKwh: number;
  peakPowerKw: number;
  avgCloudCoverPct: number | null;
  avgTemperatureC: number | null;
  sourceConfidence: "low" | "medium" | "high";
  sources: string[];
};

export type UnifiedForecastResponse = {
  meta: {
    location: {
      lat: number;
      lon: number;
    };
    capacityKw: number;
    tilt: number;
    azimuth: number;
    generatedAt: string;
    cacheTtlMs: number;
    dataSourcesUsed: string[];
    fallbackMessages: string[];
  };
  hourly: UnifiedHourlyForecast[];
  daily: UnifiedDailyForecast[];
};

export type ForecastProviderStatus = {
  providers: {
    forecastSolar: {
      state: ProviderState;
      failures: number;
      openedAt: string | null;
      nextAttemptInMs: number;
    };
    openWeather: {
      state: ProviderState;
      failures: number;
      openedAt: string | null;
      nextAttemptInMs: number;
      configured: boolean;
    };
    accuWeather: {
      state: ProviderState;
      failures: number;
      openedAt: string | null;
      nextAttemptInMs: number;
      configured: boolean;
    };
  };
  cache: {
    redisEnabled: boolean;
    redisConnected: boolean;
    inMemoryEntries: number;
    ttlMs: number;
  };
};

type ProviderTransition = {
  timestamp: string;
  state: ProviderState;
  failures: number;
};

export type ForecastProviderHistory = {
  generatedAt: string;
  providers: {
    forecastSolar: ProviderTransition[];
    openWeather: ProviderTransition[];
    accuWeather: ProviderTransition[];
  };
};

export type ForecastDebugResponse = {
  generatedAt: string;
  cache: {
    lastHitSource: CacheHitSource;
    redisEnabled: boolean;
    redisConnected: boolean;
    inMemoryEntries: number;
    ttlMs: number;
  };
  forecast: {
    lastGeneratedAt: string | null;
    responseAgeMs: number | null;
  };
  providers: {
    forecastSolar: {
      latencyMs: number | null;
      lastOutcome: "ok" | "rate-limited" | "error" | "short-circuited";
      lastError: string | null;
      updatedAt: string | null;
    };
    openWeather: {
      latencyMs: number | null;
      lastOutcome: "ok" | "rate-limited" | "error" | "short-circuited" | "not-configured";
      lastError: string | null;
      updatedAt: string | null;
      configured: boolean;
    };
    accuWeather: {
      latencyMs: number | null;
      lastOutcome: "ok" | "rate-limited" | "error" | "short-circuited" | "not-configured";
      lastError: string | null;
      updatedAt: string | null;
      configured: boolean;
    };
  };
};

type DailyPredictionsFilters = {
  nodeId?: string;
  startDate?: Date;
  endDate?: Date;
  page: number;
  pageSize: number;
};

export type DailyForecastPredictionsResponse = {
  data: Array<{
    id: string;
    nodeId: string;
    nodeName: string;
    location: string;
    forecastDate: string;
    estimatedEnergyKwh: number;
    peakPowerKw: number;
    sourceConfidence: string;
    generatedAt: string;
  }>;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
};

type ForecastSolarResponse = {
  result?: {
    watts?: Record<string, number>;
  };
};

type OpenWeatherResponse = {
  list?: Array<{
    dt: number;
    main?: {
      temp?: number;
    };
    clouds?: {
      all?: number;
    };
  }>;
};

type AccuGeoLookupResponse = {
  Key?: string;
};

type AccuHourlyResponse = Array<{
  DateTime?: string;
  EpochDateTime?: number;
  Temperature?: {
    Value?: number;
  };
  CloudCover?: number;
}>;

class UpstreamHttpError extends Error {
  public readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

const redis = getRedisClient();
const redisConnected = {
  value: false
};

// Local fast cache: complements Redis and keeps fallback behavior when Redis is down.
const memoryCache = new NodeCache({
  stdTTL: Math.floor(FORECAST_CACHE_TTL_MS / 1000),
  checkperiod: 60,
  useClones: false
});

const providerHistory: ForecastProviderHistory["providers"] = {
  forecastSolar: [],
  openWeather: [],
  accuWeather: []
};
const MAX_HISTORY_ENTRIES = 100;
const debugState: {
  lastCacheHitSource: CacheHitSource;
  lastForecastGeneratedAt: string | null;
  providers: {
    forecastSolar: {
      latencyMs: number | null;
      lastOutcome: "ok" | "rate-limited" | "error" | "short-circuited";
      lastError: string | null;
      updatedAt: string | null;
    };
    openWeather: {
      latencyMs: number | null;
      lastOutcome: "ok" | "rate-limited" | "error" | "short-circuited" | "not-configured";
      lastError: string | null;
      updatedAt: string | null;
    };
    accuWeather: {
      latencyMs: number | null;
      lastOutcome: "ok" | "rate-limited" | "error" | "short-circuited" | "not-configured";
      lastError: string | null;
      updatedAt: string | null;
    };
  };
} = {
  lastCacheHitSource: "miss",
  lastForecastGeneratedAt: null,
  providers: {
    forecastSolar: {
      latencyMs: null,
      lastOutcome: "ok",
      lastError: null,
      updatedAt: null
    },
    openWeather: {
      latencyMs: null,
      lastOutcome: "not-configured",
      lastError: null,
      updatedAt: null
    },
    accuWeather: {
      latencyMs: null,
      lastOutcome: "not-configured",
      lastError: null,
      updatedAt: null
    }
  }
};

const recordTransition = (
  provider: keyof ForecastProviderHistory["providers"],
  state: ProviderState,
  failures: number
) => {
  const entry = {
    timestamp: new Date().toISOString(),
    state,
    failures
  };
  const list = providerHistory[provider];
  list.push(entry);
  if (list.length > MAX_HISTORY_ENTRIES) {
    list.splice(0, list.length - MAX_HISTORY_ENTRIES);
  }
};

const forecastSolarBreaker = new CircuitBreaker({
  failureThreshold: env.FORECAST_CIRCUIT_FAILURE_THRESHOLD,
  openMs: env.FORECAST_CIRCUIT_OPEN_MS,
  onStateChange: (state, failures) => recordTransition("forecastSolar", state, failures)
});
const openWeatherBreaker = new CircuitBreaker({
  failureThreshold: env.FORECAST_CIRCUIT_FAILURE_THRESHOLD,
  openMs: env.FORECAST_CIRCUIT_OPEN_MS,
  onStateChange: (state, failures) => recordTransition("openWeather", state, failures)
});
const accuWeatherBreaker = new CircuitBreaker({
  failureThreshold: 2,
  openMs: env.FORECAST_CIRCUIT_OPEN_MS,
  onStateChange: (state, failures) => recordTransition("accuWeather", state, failures)
});

recordTransition("forecastSolar", "closed", 0);
recordTransition("openWeather", "closed", 0);
recordTransition("accuWeather", "closed", 0);

const toCacheKey = (params: Required<ForecastParams>): string => {
  return `forecast:${params.lat.toFixed(4)}:${params.lon.toFixed(4)}:${params.capacity.toFixed(2)}:${params.tilt.toFixed(1)}:${params.azimuth.toFixed(1)}`;
};

const normalizeHour = (value: string): string => {
  const date = new Date(value);
  date.setMinutes(0, 0, 0);
  return date.toISOString();
};

const dayKey = (iso: string): string => iso.slice(0, 10);

const toIrradianceEstimate = (cloudCoverPct: number | null): number | null => {
  if (cloudCoverPct === null) return null;
  return Number((1000 * Math.max(0, 1 - cloudCoverPct / 100)).toFixed(1));
};

const toConfidence = (sourcesCount: number): "low" | "medium" | "high" => {
  if (sourcesCount >= 3) return "high";
  if (sourcesCount === 2) return "medium";
  return "low";
};

const safeFetchJson = async <T>(url: string, timeoutMs = 9000): Promise<T> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new UpstreamHttpError(response.status, `Upstream returned HTTP ${response.status}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
};

const ensureRedisConnection = async (): Promise<boolean> => {
  if (!redis) return false;
  if (redisConnected.value) return true;
  try {
    await redis.connect();
    redisConnected.value = true;
    return true;
  } catch {
    return false;
  }
};

const readCache = async (key: string): Promise<{value: UnifiedForecastResponse | null; source: CacheHitSource}> => {
  const inMemory = memoryCache.get<UnifiedForecastResponse>(key);
  if (inMemory) {
    return {
      value: inMemory,
      source: "memory"
    };
  }

  if (!(await ensureRedisConnection()) || !redis) {
    return {
      value: null,
      source: "miss"
    };
  }

  const raw = await redis.get(key);
  if (!raw) {
    return {
      value: null,
      source: "miss"
    };
  }

  try {
    const parsed = JSON.parse(raw) as UnifiedForecastResponse;
    memoryCache.set(key, parsed, Math.floor(FORECAST_CACHE_TTL_MS / 1000));
    return {
      value: parsed,
      source: "redis"
    };
  } catch {
    return {
      value: null,
      source: "miss"
    };
  }
};

const writeCache = async (key: string, value: UnifiedForecastResponse): Promise<void> => {
  memoryCache.set(key, value, Math.floor(FORECAST_CACHE_TTL_MS / 1000));

  if (!(await ensureRedisConnection()) || !redis) {
    return;
  }

  await redis.set(key, JSON.stringify(value), "PX", FORECAST_CACHE_TTL_MS);
};

export const clearForecastCache = async (): Promise<{ inMemoryEntriesCleared: number; redisEntriesCleared: number }> => {
  const inMemoryEntriesCleared = memoryCache.keys().length;
  memoryCache.flushAll();

  let redisEntriesCleared = 0;
  if (!(await ensureRedisConnection()) || !redis) {
    return {
      inMemoryEntriesCleared,
      redisEntriesCleared
    };
  }

  const redisKeys = await redis.keys("forecast:*");
  if (redisKeys.length > 0) {
    redisEntriesCleared = redisKeys.length;
    await redis.del(redisKeys);
  }

  return {
    inMemoryEntriesCleared,
    redisEntriesCleared
  };
};

const callWithBreaker = async <T>(
  providerKey: "forecastSolar" | "openWeather" | "accuWeather",
  providerName: string,
  breaker: CircuitBreaker,
  runner: () => Promise<T>,
  warnings: string[]
): Promise<T | null> => {
  const startedAt = Date.now();
  if (!breaker.canExecute()) {
    warnings.push(`${providerName} temporarily short-circuited due to repeated failures.`);
    debugState.providers[providerKey].latencyMs = 0;
    debugState.providers[providerKey].lastOutcome = "short-circuited";
    debugState.providers[providerKey].lastError = "Circuit open";
    debugState.providers[providerKey].updatedAt = new Date().toISOString();
    return null;
  }

  try {
    const value = await runner();
    breaker.onSuccess();
    debugState.providers[providerKey].latencyMs = Date.now() - startedAt;
    debugState.providers[providerKey].lastOutcome = "ok";
    debugState.providers[providerKey].lastError = null;
    debugState.providers[providerKey].updatedAt = new Date().toISOString();
    return value;
  } catch (error) {
    breaker.onFailure();
    debugState.providers[providerKey].latencyMs = Date.now() - startedAt;
    debugState.providers[providerKey].updatedAt = new Date().toISOString();
    if (error instanceof UpstreamHttpError && error.statusCode === 429) {
      warnings.push(`${providerName} rate limit reached. Serving fallback data.`);
      debugState.providers[providerKey].lastOutcome = "rate-limited";
      debugState.providers[providerKey].lastError = error.message;
      return null;
    }

    warnings.push(`${providerName} unavailable. Serving fallback data.`);
    debugState.providers[providerKey].lastOutcome = "error";
    debugState.providers[providerKey].lastError = error instanceof Error ? error.message : "Unknown error";
    return null;
  }
};

const fetchForecastSolar = async (params: Required<ForecastParams>) => {
  const url = `https://api.forecast.solar/estimate/${params.lat}/${params.lon}/${params.tilt}/${params.azimuth}/${params.capacity}`;
  const payload = await safeFetchJson<ForecastSolarResponse>(url);
  return payload.result ?? null;
};

const fetchOpenWeather = async (params: Required<ForecastParams>) => {
  if (!env.OPENWEATHER_API_KEY) return null;
  const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${params.lat}&lon=${params.lon}&units=metric&appid=${env.OPENWEATHER_API_KEY}`;
  return safeFetchJson<OpenWeatherResponse>(url);
};

const fetchAccuWeather = async (params: Required<ForecastParams>) => {
  if (!env.ACCUWEATHER_API_KEY) return null;

  // AccuWeather is intentionally backup-only due to tighter free-tier quotas.
  const geoUrl = `https://dataservice.accuweather.com/locations/v1/cities/geoposition/search?apikey=${env.ACCUWEATHER_API_KEY}&q=${params.lat}%2C${params.lon}`;
  const lookup = await safeFetchJson<AccuGeoLookupResponse>(geoUrl);
  if (!lookup.Key) return null;

  const hourlyUrl = `https://dataservice.accuweather.com/forecasts/v1/hourly/12hour/${lookup.Key}?apikey=${env.ACCUWEATHER_API_KEY}&metric=true`;
  return safeFetchJson<AccuHourlyResponse>(hourlyUrl);
};

const buildWeatherOnlyHourly = (
  params: Required<ForecastParams>,
  openWeather: OpenWeatherResponse
): UnifiedHourlyForecast[] => {
  return openWeather.list?.slice(0, 24).map((item) => {
    const timestamp = normalizeHour(new Date(item.dt * 1000).toISOString());
    const cloudCover = item.clouds?.all ?? null;
    const irradiance = toIrradianceEstimate(cloudCover);
    const estimatedPowerKw = irradiance === null ? 0 : Number((params.capacity * Math.max(0.08, irradiance / 1000)).toFixed(2));

    return {
      timestamp,
      estimatedPowerKw,
      cloudCoverPct: cloudCover,
      temperatureC: item.main?.temp ?? null,
      irradianceWm2: irradiance,
      sources: ["openweathermap", "weather-derived"]
    };
  }) ?? [];
};

const buildAccuWeatherOnlyHourly = (
  params: Required<ForecastParams>,
  accuWeather: AccuHourlyResponse
): UnifiedHourlyForecast[] => {
  const baseHour = new Date();
  baseHour.setMinutes(0, 0, 0);

  return accuWeather.slice(0, 24).map((item, index) => {
    const pointDate = typeof item.EpochDateTime === "number" ?
      new Date(item.EpochDateTime * 1000) :
      item.DateTime ?
      new Date(item.DateTime) :
      new Date(baseHour.getTime() + index * 60 * 60 * 1000);
    const normalizedTimestamp = normalizeHour(pointDate.toISOString());

    const cloudCover = typeof item.CloudCover === "number" ? item.CloudCover : null;
    const irradiance = toIrradianceEstimate(cloudCover);
    const hour = pointDate.getHours();
    const daytimeFactor = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI));
    const estimatedPowerKw = irradiance === null ?
      Number((params.capacity * 0.82 * daytimeFactor).toFixed(2)) :
      Number((params.capacity * Math.max(0.08, irradiance / 1000)).toFixed(2));

    return {
      timestamp: normalizedTimestamp,
      estimatedPowerKw,
      cloudCoverPct: cloudCover,
      temperatureC: item.Temperature?.Value ?? null,
      irradianceWm2: irradiance,
      sources: ["accuweather", "weather-derived"]
    };
  });
};

const buildSyntheticFallbackHourly = (params: Required<ForecastParams>): UnifiedHourlyForecast[] => {
  const baseHour = new Date();
  baseHour.setMinutes(0, 0, 0);

  return Array.from({ length: 24 }, (_, index) => {
    const pointDate = new Date(baseHour.getTime() + index * 60 * 60 * 1000);
    const hour = pointDate.getHours();
    const daytimeFactor = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI));
    const estimatedPowerKw = Number((params.capacity * 0.82 * daytimeFactor).toFixed(2));

    return {
      timestamp: normalizeHour(pointDate.toISOString()),
      estimatedPowerKw,
      cloudCoverPct: null,
      temperatureC: null,
      irradianceWm2: null,
      sources: ["synthetic-fallback"]
    };
  });
};

export const getHybridForecast = async (input: ForecastParams): Promise<UnifiedForecastResponse> => {
  const params: Required<ForecastParams> = {
    lat: input.lat,
    lon: input.lon,
    capacity: input.capacity,
    tilt: input.tilt ?? DEFAULT_FORECAST_TILT,
    azimuth: input.azimuth ?? DEFAULT_FORECAST_AZIMUTH
  };

  const cacheKey = toCacheKey(params);
  const cached = await readCache(cacheKey);
  debugState.lastCacheHitSource = cached.source;
  if (cached.value) {
    debugState.lastForecastGeneratedAt = cached.value.meta.generatedAt;
    return cached.value;
  }

  const warnings: string[] = [];
  const sourcesUsed = new Set<string>();

  // Priority: Forecast.Solar for PV production profile.
  const forecastSolar = await callWithBreaker(
    "forecastSolar",
    "Forecast.Solar",
    forecastSolarBreaker,
    () => fetchForecastSolar(params),
    warnings
  );
  if (forecastSolar) {
    sourcesUsed.add("forecast.solar");
  }

  // OpenWeatherMap enriches cloud cover/temperature/irradiance on top of PV profile.
  let openWeather: OpenWeatherResponse | null = null;
  if (!env.OPENWEATHER_API_KEY) {
    debugState.providers.openWeather.lastOutcome = "not-configured";
    debugState.providers.openWeather.lastError = "OPENWEATHER_API_KEY not set";
    debugState.providers.openWeather.updatedAt = new Date().toISOString();
  } else {
    openWeather = await callWithBreaker(
      "openWeather",
      "OpenWeatherMap",
      openWeatherBreaker,
      () => fetchOpenWeather(params),
      warnings
    );
    if (openWeather) {
      sourcesUsed.add("openweathermap");
    } else {
      warnings.push("OpenWeatherMap enrichment missing (cloud/temperature/irradiance may be partial).");
    }
  }

  // AccuWeather is backup-only and used only for missing temperature fields.
  let accuWeather: AccuHourlyResponse | null = null;
  if (!env.ACCUWEATHER_API_KEY) {
    debugState.providers.accuWeather.lastOutcome = "not-configured";
    debugState.providers.accuWeather.lastError = "ACCUWEATHER_API_KEY not set";
    debugState.providers.accuWeather.updatedAt = new Date().toISOString();
  } else {
    accuWeather = await callWithBreaker(
      "accuWeather",
      "AccuWeather",
      accuWeatherBreaker,
      () => fetchAccuWeather(params),
      warnings
    );
    if (accuWeather) {
      sourcesUsed.add("accuweather");
    }
  }

  const forecastEntries = Object.entries(forecastSolar?.watts ?? {}).slice(0, 72);
  let hourly: UnifiedHourlyForecast[] = [];
  if (forecastEntries.length > 0) {
    hourly = forecastEntries.map(([timestamp, watts], idx) => {
      const hour = normalizeHour(timestamp);
      const weatherPoint = openWeather?.list?.
      find((item) => normalizeHour(new Date(item.dt * 1000).toISOString()) === hour);
      const backupTemp = accuWeather?.[idx]?.Temperature?.Value ?? null;

      const cloudCover = weatherPoint?.clouds?.all ?? null;
      const temperature = weatherPoint?.main?.temp ?? backupTemp;

      return {
        timestamp: hour,
        estimatedPowerKw: Number((watts / 1000).toFixed(2)),
        cloudCoverPct: cloudCover,
        temperatureC: temperature,
        irradianceWm2: toIrradianceEstimate(cloudCover),
        sources: Array.from(sourcesUsed)
      };
    });
  } else if (openWeather?.list?.length) {
    hourly = buildWeatherOnlyHourly(params, openWeather);
    sourcesUsed.add("openweathermap");
    sourcesUsed.add("weather-derived");
  } else if (accuWeather?.length) {
    hourly = buildAccuWeatherOnlyHourly(params, accuWeather);
    sourcesUsed.add("accuweather");
    sourcesUsed.add("weather-derived");
    warnings.push("Using AccuWeather-only fallback forecast due to missing/unavailable primary providers.");
  } else {
    warnings.push("All forecast providers unavailable. Serving synthetic baseline forecast.");
    sourcesUsed.add("synthetic-fallback");
    hourly = buildSyntheticFallbackHourly(params);
  }

  const grouped = new Map<string, UnifiedHourlyForecast[]>();
  for (const point of hourly) {
    const key = dayKey(point.timestamp);
    const existing = grouped.get(key) ?? [];
    existing.push(point);
    grouped.set(key, existing);
  }

  const daily = Array.from(grouped.entries()).slice(0, 7).map(([date, points]) => {
    const estimatedEnergyKwh = Number(points.reduce((sum, p) => sum + p.estimatedPowerKw, 0).toFixed(2));
    const peakPowerKw = Number(Math.max(...points.map((p) => p.estimatedPowerKw), 0).toFixed(2));

    const cloudValues = points.map((p) => p.cloudCoverPct).filter((v): v is number => v !== null);
    const tempValues = points.map((p) => p.temperatureC).filter((v): v is number => v !== null);

    return {
      date,
      estimatedEnergyKwh,
      peakPowerKw,
      avgCloudCoverPct: cloudValues.length ? Number((cloudValues.reduce((a, b) => a + b, 0) / cloudValues.length).toFixed(1)) : null,
      avgTemperatureC: tempValues.length ? Number((tempValues.reduce((a, b) => a + b, 0) / tempValues.length).toFixed(1)) : null,
      sourceConfidence: toConfidence(sourcesUsed.size),
      sources: Array.from(sourcesUsed)
    };
  });

  const response: UnifiedForecastResponse = {
    meta: {
      location: {
        lat: params.lat,
        lon: params.lon
      },
      capacityKw: params.capacity,
      tilt: params.tilt,
      azimuth: params.azimuth,
      generatedAt: new Date().toISOString(),
      cacheTtlMs: FORECAST_CACHE_TTL_MS,
      dataSourcesUsed: Array.from(sourcesUsed),
      fallbackMessages: warnings
    },
    hourly,
    daily
  };

  await writeCache(cacheKey, response);
  debugState.lastForecastGeneratedAt = response.meta.generatedAt;
  debugState.lastCacheHitSource = "miss";
  return response;
};

export const getForecastProvidersStatus = (): ForecastProviderStatus => {
  const solar = forecastSolarBreaker.snapshot();
  const openWeather = openWeatherBreaker.snapshot();
  const accuWeather = accuWeatherBreaker.snapshot();

  return {
    providers: {
      forecastSolar: {
        state: solar.state,
        failures: solar.failures,
        openedAt: solar.openedAt ? new Date(solar.openedAt).toISOString() : null,
        nextAttemptInMs: solar.nextAttemptInMs
      },
      openWeather: {
        state: openWeather.state,
        failures: openWeather.failures,
        openedAt: openWeather.openedAt ? new Date(openWeather.openedAt).toISOString() : null,
        nextAttemptInMs: openWeather.nextAttemptInMs,
        configured: Boolean(env.OPENWEATHER_API_KEY)
      },
      accuWeather: {
        state: accuWeather.state,
        failures: accuWeather.failures,
        openedAt: accuWeather.openedAt ? new Date(accuWeather.openedAt).toISOString() : null,
        nextAttemptInMs: accuWeather.nextAttemptInMs,
        configured: Boolean(env.ACCUWEATHER_API_KEY)
      }
    },
    cache: {
      redisEnabled: Boolean(env.REDIS_URL),
      redisConnected: redisConnected.value,
      inMemoryEntries: memoryCache.keys().length,
      ttlMs: FORECAST_CACHE_TTL_MS
    }
  };
};

export const getForecastProvidersHistory = (): ForecastProviderHistory => {
  return {
    generatedAt: new Date().toISOString(),
    providers: {
      forecastSolar: [...providerHistory.forecastSolar],
      openWeather: [...providerHistory.openWeather],
      accuWeather: [...providerHistory.accuWeather]
    }
  };
};

export const getForecastDebug = (): ForecastDebugResponse => {
  const now = Date.now();
  const responseAgeMs = debugState.lastForecastGeneratedAt ?
  Math.max(0, now - new Date(debugState.lastForecastGeneratedAt).getTime()) :
  null;

  return {
    generatedAt: new Date().toISOString(),
    cache: {
      lastHitSource: debugState.lastCacheHitSource,
      redisEnabled: Boolean(env.REDIS_URL),
      redisConnected: redisConnected.value,
      inMemoryEntries: memoryCache.keys().length,
      ttlMs: FORECAST_CACHE_TTL_MS
    },
    forecast: {
      lastGeneratedAt: debugState.lastForecastGeneratedAt,
      responseAgeMs
    },
    providers: {
      forecastSolar: {
        latencyMs: debugState.providers.forecastSolar.latencyMs,
        lastOutcome: debugState.providers.forecastSolar.lastOutcome,
        lastError: debugState.providers.forecastSolar.lastError,
        updatedAt: debugState.providers.forecastSolar.updatedAt
      },
      openWeather: {
        latencyMs: debugState.providers.openWeather.latencyMs,
        lastOutcome: debugState.providers.openWeather.lastOutcome,
        lastError: debugState.providers.openWeather.lastError,
        updatedAt: debugState.providers.openWeather.updatedAt,
        configured: Boolean(env.OPENWEATHER_API_KEY)
      },
      accuWeather: {
        latencyMs: debugState.providers.accuWeather.latencyMs,
        lastOutcome: debugState.providers.accuWeather.lastOutcome,
        lastError: debugState.providers.accuWeather.lastError,
        updatedAt: debugState.providers.accuWeather.updatedAt,
        configured: Boolean(env.ACCUWEATHER_API_KEY)
      }
    }
  };
};

export const getDailyForecastPredictions = async ({
  nodeId,
  startDate,
  endDate,
  page,
  pageSize
}: DailyPredictionsFilters): Promise<DailyForecastPredictionsResponse> => {
  if (startDate && endDate && startDate > endDate) {
    throw new AppError("startDate must be before or equal to endDate.", 400);
  }

  const where = {
    ...(nodeId ? { nodeId } : {}),
    ...(startDate || endDate ?
    {
      forecastDate: {
        ...(startDate ? { gte: startDate } : {}),
        ...(endDate ? { lte: endDate } : {})
      }
    } :
    {})
  };

  const skip = (page - 1) * pageSize;

  const [total, rows] = await Promise.all([
    prisma.dailyForecastPrediction.count({ where }),
    prisma.dailyForecastPrediction.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: [{ forecastDate: "desc" }, { generatedAt: "desc" }],
      include: {
        node: {
          select: {
            id: true,
            name: true,
            location: true
          }
        }
      }
    })
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return {
    data: rows.map((row) => ({
      id: row.id,
      nodeId: row.nodeId,
      nodeName: row.node.name,
      location: row.node.location,
      forecastDate: row.forecastDate.toISOString(),
      estimatedEnergyKwh: row.estimatedEnergyKwh,
      peakPowerKw: row.peakPowerKw,
      sourceConfidence: row.sourceConfidence,
      generatedAt: row.generatedAt.toISOString()
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    }
  };
};
