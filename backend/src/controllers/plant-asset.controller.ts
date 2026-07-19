import type { Request, Response } from "express";
import { AssetType } from "@prisma/client";

import {
  createAsset,
  createPlant,
  linkEdgeNodeToAsset,
  listAssets,
  listPlants,
  updateAssetParent
} from "../services/plant-asset.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";

export const getPlantsHandler = asyncHandler(async (req: Request, res: Response) => {
  const data = await listPlants(req.user);
  res.status(200).json({ data });
});

export const postPlantHandler = asyncHandler(async (req: Request, res: Response) => {
  const data = await createPlant(req.body, req.user?.id);
  res.status(201).json({ data });
});

export const getAssetsHandler = asyncHandler(async (req: Request, res: Response) => {
  const plantId = req.params.plantId;
  if (!plantId) throw new AppError("plantId is required.", 400);
  const data = await listAssets(plantId, req.user);
  res.status(200).json({ data });
});

export const postAssetHandler = asyncHandler(async (req: Request, res: Response) => {
  const plantId = req.params.plantId;
  if (!plantId) throw new AppError("plantId is required.", 400);
  const data = await createAsset(
    {
      plantId,
      type: req.body.type as AssetType,
      name: req.body.name,
      parentAssetId: req.body.parentAssetId,
      serialNumber: req.body.serialNumber,
      ratedPowerKw: req.body.ratedPowerKw,
      ratedEnergyKwh: req.body.ratedEnergyKwh,
      metadata: req.body.metadata
    },
    req.user?.id
  );
  res.status(201).json({ data });
});

export const patchAssetParentHandler = asyncHandler(async (req: Request, res: Response) => {
  const assetId = req.params.assetId;
  if (!assetId) throw new AppError("assetId is required.", 400);
  const data = await updateAssetParent(assetId, req.body.parentAssetId ?? null, req.user?.id);
  res.status(200).json({ data });
});

export const postLinkEdgeNodeAssetHandler = asyncHandler(async (req: Request, res: Response) => {
  const data = await linkEdgeNodeToAsset(req.body.edgeNodeId, req.body.assetId, req.user?.id);
  res.status(200).json({ data });
});
