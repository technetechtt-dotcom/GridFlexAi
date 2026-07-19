import type { Request, Response } from "express";

import {
  createForecastRun,
  getPlantForecastConfig,
  listForecastAccuracyScores,
  listForecastRuns,
  scoreAndPersistForecastAccuracy,
  upsertPlantForecastConfig
} from "../services/forecast-accuracy.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";

export const getForecastAccuracyScoresHandler = asyncHandler(async (req: Request, res: Response) => {
  const filters: { plantId?: string; horizonMinutes?: number; limit?: number } = {};
  if (typeof req.query.plantId === "string") filters.plantId = req.query.plantId;
  if (typeof req.query.horizonMinutes === "string") filters.horizonMinutes = Number(req.query.horizonMinutes);
  if (typeof req.query.limit === "string") filters.limit = Number(req.query.limit);
  const data = await listForecastAccuracyScores(filters, req.user);
  res.status(200).json({ data });
});

export const postForecastAccuracyScoreHandler = asyncHandler(async (req: Request, res: Response) => {
  const data = await scoreAndPersistForecastAccuracy(req.body, req.user?.id, req.user);
  res.status(201).json({ data });
});

export const getForecastRunsHandler = asyncHandler(async (req: Request, res: Response) => {
  const filters: { plantId?: string; limit?: number } = {};
  if (typeof req.query.plantId === "string") filters.plantId = req.query.plantId;
  if (typeof req.query.limit === "string") filters.limit = Number(req.query.limit);
  const data = await listForecastRuns(filters, req.user);
  res.status(200).json({ data });
});

export const postForecastRunHandler = asyncHandler(async (req: Request, res: Response) => {
  const data = await createForecastRun(req.body, req.user?.id, req.user);
  res.status(201).json({ data });
});

export const getPlantForecastConfigHandler = asyncHandler(async (req: Request, res: Response) => {
  const plantId = req.params.plantId;
  if (!plantId) throw new AppError("plantId is required.", 400);
  const data = await getPlantForecastConfig(plantId, req.user);
  res.status(200).json({ data });
});

export const putPlantForecastConfigHandler = asyncHandler(async (req: Request, res: Response) => {
  const plantId = req.params.plantId;
  if (!plantId) throw new AppError("plantId is required.", 400);
  const data = await upsertPlantForecastConfig(plantId, req.body, req.user?.id, req.user);
  res.status(200).json({ data });
});
