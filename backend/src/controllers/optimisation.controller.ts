import type { Request, Response } from "express";

import {
  getBessModel,
  getElectrolyserModel,
  getOptimisationRun,
  listOptimisationRuns,
  runAdvisoryOptimisation,
  upsertBessConfiguration,
  upsertElectrolyserConfiguration
} from "../services/optimisation.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";

export const getBessModelHandler = asyncHandler(async (req: Request, res: Response) => {
  const assetId = req.params.assetId;
  if (!assetId) throw new AppError("assetId is required.", 400);
  const data = await getBessModel(assetId, req.user);
  res.status(200).json({ data });
});

export const putBessConfigurationHandler = asyncHandler(async (req: Request, res: Response) => {
  const assetId = req.params.assetId;
  if (!assetId) throw new AppError("assetId is required.", 400);
  const data = await upsertBessConfiguration(assetId, req.body, req.user);
  res.status(200).json({ data });
});

export const getElectrolyserModelHandler = asyncHandler(async (req: Request, res: Response) => {
  const assetId = req.params.assetId;
  if (!assetId) throw new AppError("assetId is required.", 400);
  const data = await getElectrolyserModel(assetId, req.user);
  res.status(200).json({ data });
});

export const putElectrolyserConfigurationHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const assetId = req.params.assetId;
    if (!assetId) throw new AppError("assetId is required.", 400);
    const data = await upsertElectrolyserConfiguration(assetId, req.body, req.user);
    res.status(200).json({ data });
  }
);

export const getOptimisationRunsHandler = asyncHandler(async (req: Request, res: Response) => {
  const filters: { plantId?: string; siteId?: string; limit?: number } = {};
  if (typeof req.query.plantId === "string") filters.plantId = req.query.plantId;
  if (typeof req.query.siteId === "string") filters.siteId = req.query.siteId;
  if (typeof req.query.limit === "string") filters.limit = Number(req.query.limit);
  const data = await listOptimisationRuns(filters, req.user);
  res.status(200).json({ data });
});

export const postOptimisationRunHandler = asyncHandler(async (req: Request, res: Response) => {
  const data = await runAdvisoryOptimisation(
    {
      plantId: req.body.plantId,
      bessAssetId: req.body.bessAssetId,
      electrolyserAssetId: req.body.electrolyserAssetId,
      horizon: req.body.horizon,
      weights: req.body.weights,
      objective: req.body.objective
    },
    req.user?.id,
    req.user
  );
  res.status(201).json({ data });
});

export const getOptimisationRunHandler = asyncHandler(async (req: Request, res: Response) => {
  const runId = req.params.runId;
  if (!runId) throw new AppError("runId is required.", 400);
  const data = await getOptimisationRun(runId, req.user);
  res.status(200).json({ data });
});
