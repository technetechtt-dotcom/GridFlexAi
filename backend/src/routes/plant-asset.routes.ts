import { Router } from "express";
import { z } from "zod";

import {
  getAssetsHandler,
  getPlantsHandler,
  patchAssetParentHandler,
  postAssetHandler,
  postLinkEdgeNodeAssetHandler,
  postPlantHandler
} from "../controllers/plant-asset.controller.js";
import { authenticate, authorizeRoles, requireRoles } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { ASSET_TYPES } from "../domain/provenance.js";

const plantBodySchema = z.object({
  organisationId: z.string().min(1),
  siteId: z.string().min(1),
  name: z.string().min(2).max(120),
  code: z.string().min(2).max(64),
  technology: z.string().optional(),
  installedCapacityKw: z.coerce.number().min(0).optional(),
  exportCapacityKw: z.coerce.number().min(0).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional()
});

const assetBodySchema = z.object({
  type: z.enum(ASSET_TYPES),
  name: z.string().min(2).max(120),
  parentAssetId: z.string().optional(),
  serialNumber: z.string().optional(),
  ratedPowerKw: z.coerce.number().min(0).optional(),
  ratedEnergyKwh: z.coerce.number().min(0).optional(),
  metadata: z.unknown().optional()
});

const assetParentBodySchema = z.object({
  parentAssetId: z.string().nullable()
});

const linkBodySchema = z.object({
  edgeNodeId: z.string().min(1),
  assetId: z.string().min(1)
});

const router = Router();

// Authenticate per-route only. Do not use router.use(authenticate) when this
// router is mounted at "/", or it will intercept unrelated paths (e.g. /edge-data).
router.get("/plants", authenticate, getPlantsHandler);
router.post(
  "/plants",
  authenticate,
  authorizeRoles("admin", "developer"),
  validateRequest({ body: plantBodySchema }),
  postPlantHandler
);
router.get("/plants/:plantId/assets", authenticate, getAssetsHandler);
router.post(
  "/plants/:plantId/assets",
  authenticate,
  requireRoles("admin", "developer", "manager"),
  validateRequest({ body: assetBodySchema }),
  postAssetHandler
);
router.patch(
  "/assets/:assetId/parent",
  authenticate,
  authorizeRoles("admin", "developer"),
  validateRequest({ body: assetParentBodySchema }),
  patchAssetParentHandler
);
router.post(
  "/assets/link-edge-node",
  authenticate,
  authorizeRoles("admin", "developer"),
  validateRequest({ body: linkBodySchema }),
  postLinkEdgeNodeAssetHandler
);

export default router;
