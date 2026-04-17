import type { Request, Response } from "express";
import type { ParsedQs } from "qs";

import type { DailyForecastPredictionsQuery, ForecastQuery } from "../schemas/request.schemas.js";
import {
  getDailyForecastPredictions,
  getForecastDebug,
  getForecastProvidersHistory,
  getForecastProvidersStatus,
  getHybridForecast,
  type ForecastDebugResponse,
  type DailyForecastPredictionsResponse,
  type ForecastProviderHistory,
  type ForecastProviderStatus,
  type UnifiedForecastResponse } from
"../services/forecast.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

type ForecastResponse = UnifiedForecastResponse;

export const getForecast = asyncHandler(async (
  req: Request<Record<string, never>, ForecastResponse, unknown, ParsedQs>,
  res: Response<ForecastResponse>
) => {
  const query = req.query as unknown as ForecastQuery;

  const params = {
    lat: query.lat,
    lon: query.lon,
    capacity: query.capacity
  } as Parameters<typeof getHybridForecast>[0];

  if (typeof query.tilt === "number") {
    params.tilt = query.tilt;
  }
  if (typeof query.azimuth === "number") {
    params.azimuth = query.azimuth;
  }

  const forecast = await getHybridForecast(params);

  res.status(200).json(forecast);
});

export const getForecastProviders = asyncHandler(async (
  _req: Request<Record<string, never>, ForecastProviderStatus>,
  res: Response<ForecastProviderStatus>
) => {
  res.status(200).json(getForecastProvidersStatus());
});

export const getForecastProvidersHistoryController = asyncHandler(async (
  _req: Request<Record<string, never>, ForecastProviderHistory>,
  res: Response<ForecastProviderHistory>
) => {
  res.status(200).json(getForecastProvidersHistory());
});

export const getForecastDebugController = asyncHandler(async (
  _req: Request<Record<string, never>, ForecastDebugResponse>,
  res: Response<ForecastDebugResponse>
) => {
  res.status(200).json(getForecastDebug());
});

export const getDailyForecastPredictionsController = asyncHandler(async (
  req: Request<Record<string, never>, DailyForecastPredictionsResponse, unknown, ParsedQs>,
  res: Response<DailyForecastPredictionsResponse>
) => {
  const query = req.query as unknown as DailyForecastPredictionsQuery;
  const filters = {
    page: query.page,
    pageSize: query.pageSize
  } as Parameters<typeof getDailyForecastPredictions>[0];
  if (query.nodeId) {
    filters.nodeId = query.nodeId;
  }
  if (query.startDate) {
    filters.startDate = new Date(query.startDate);
  }
  if (query.endDate) {
    filters.endDate = new Date(query.endDate);
  }
  const data = await getDailyForecastPredictions(filters);
  res.status(200).json(data);
});
