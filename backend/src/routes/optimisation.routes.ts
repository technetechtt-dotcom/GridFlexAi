import { Router } from "express";
import { z } from "zod";

import {
  getBessModelHandler,
  getElectrolyserModelHandler,
  getOptimisationRunHandler,
  getOptimisationRunsHandler,
  postOptimisationRunHandler,
  putBessConfigurationHandler,
  putElectrolyserConfigurationHandler
} from "../controllers/optimisation.controller.js";
import { DATA_SOURCE_TYPES } from "../domain/provenance.js";
import { authenticate, requireRoles } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validateRequest.js";

const assetIdParamsSchema = z.object({
  assetId: z.string().min(1)
});

const runIdParamsSchema = z.object({
  runId: z.string().min(1)
});

const optimisationRunsQuerySchema = z.object({
  plantId: z.string().optional(),
  siteId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional()
});

const bessConfigurationBodySchema = z.object({
  ratedPowerKw: z.coerce.number().finite().positive().optional(),
  ratedEnergyKwh: z.coerce.number().finite().positive().optional(),
  minSocPercent: z.coerce.number().min(0).max(100).optional(),
  maxSocPercent: z.coerce.number().min(0).max(100).optional(),
  chargeEfficiency: z.coerce.number().gt(0).max(1).optional(),
  dischargeEfficiency: z.coerce.number().gt(0).max(1).optional(),
  maxChargePowerKw: z.coerce.number().finite().positive().optional(),
  maxDischargePowerKw: z.coerce.number().finite().positive().optional(),
  rampLimitKwPerMin: z.coerce.number().finite().positive().optional(),
  degradationCostZarPerMwh: z.coerce.number().finite().min(0).optional(),
  reserveSocPercent: z.coerce.number().min(0).max(100).optional(),
  minOperatingTempC: z.coerce.number().finite().nullable().optional(),
  maxOperatingTempC: z.coerce.number().finite().nullable().optional(),
  warrantyCycleLimit: z.coerce.number().int().positive().nullable().optional(),
  simulationMode: z.boolean().optional(),
  configSource: z.enum(DATA_SOURCE_TYPES).optional()
});

const electrolyserConfigurationBodySchema = z.object({
  technology: z.string().min(1).max(40).optional(),
  minStableLoadKw: z.coerce.number().finite().min(0).optional(),
  maxLoadKw: z.coerce.number().finite().positive().optional(),
  rampRateKwPerMin: z.coerce.number().finite().positive().optional(),
  startUpTimeMin: z.coerce.number().finite().min(0).optional(),
  shutDownTimeMin: z.coerce.number().finite().min(0).optional(),
  minRunTimeMin: z.coerce.number().finite().min(0).optional(),
  efficiencyKwhPerKg: z.coerce.number().finite().positive().optional(),
  waterLitresPerKg: z.coerce.number().finite().positive().optional(),
  hydrogenStorageCapacityKg: z.coerce.number().finite().positive().optional(),
  hydrogenSalePriceZarPerKg: z.coerce.number().finite().min(0).optional(),
  operatingCostZarPerHour: z.coerce.number().finite().min(0).optional(),
  minOperatingTempC: z.coerce.number().finite().nullable().optional(),
  maxOperatingTempC: z.coerce.number().finite().nullable().optional(),
  maintenanceWindowActive: z.boolean().optional(),
  simulationMode: z.boolean().optional(),
  configSource: z.enum(DATA_SOURCE_TYPES).optional()
});

const optimisationRunBodySchema = z.object({
  plantId: z.string().min(1),
  bessAssetId: z.string().min(1),
  electrolyserAssetId: z.string().min(1),
  objective: z.string().min(1).max(120).optional(),
  horizon: z
    .array(
      z.object({
        start: z.string().datetime(),
        durationMinutes: z.coerce.number().int().positive().max(24 * 60),
        generationForecastKw: z.coerce.number().finite().min(0),
        exportLimitKw: z.coerce.number().finite().min(0),
        demandKw: z.coerce.number().finite().min(0),
        forecastConfidence: z.coerce.number().min(0).max(1).optional()
      })
    )
    .min(1)
    .max(168)
    .optional(),
  weights: z
    .object({
      exportRevenueZarPerMwh: z.coerce.number().finite().optional(),
      hydrogenRevenueZarPerKg: z.coerce.number().finite().optional(),
      curtailmentAvoidanceZarPerMwh: z.coerce.number().finite().optional(),
      degradationCostZarPerMwh: z.coerce.number().finite().optional(),
      electrolyserOperatingCostZarPerHour: z.coerce.number().finite().optional()
    })
    .optional()
});

const router = Router();

// Per-route auth: mounted at "/" must not intercept unrelated paths.
const writeRoles = ["admin", "developer", "manager"] as const;

router.get(
  "/assets/:assetId/bess-model",
  authenticate,
  validateRequest({ params: assetIdParamsSchema }),
  getBessModelHandler
);
router.get(
  "/assets/:assetId/bess-configuration",
  authenticate,
  validateRequest({ params: assetIdParamsSchema }),
  getBessModelHandler
);
router.put(
  "/assets/:assetId/bess-model",
  authenticate,
  requireRoles(...writeRoles),
  validateRequest({ params: assetIdParamsSchema, body: bessConfigurationBodySchema }),
  putBessConfigurationHandler
);
router.put(
  "/assets/:assetId/bess-configuration",
  authenticate,
  requireRoles(...writeRoles),
  validateRequest({ params: assetIdParamsSchema, body: bessConfigurationBodySchema }),
  putBessConfigurationHandler
);

router.get(
  "/assets/:assetId/electrolyser-model",
  authenticate,
  validateRequest({ params: assetIdParamsSchema }),
  getElectrolyserModelHandler
);
router.get(
  "/assets/:assetId/electrolyser-configuration",
  authenticate,
  validateRequest({ params: assetIdParamsSchema }),
  getElectrolyserModelHandler
);
router.put(
  "/assets/:assetId/electrolyser-model",
  authenticate,
  requireRoles(...writeRoles),
  validateRequest({ params: assetIdParamsSchema, body: electrolyserConfigurationBodySchema }),
  putElectrolyserConfigurationHandler
);
router.put(
  "/assets/:assetId/electrolyser-configuration",
  authenticate,
  requireRoles(...writeRoles),
  validateRequest({ params: assetIdParamsSchema, body: electrolyserConfigurationBodySchema }),
  putElectrolyserConfigurationHandler
);

router.get(
  "/optimisation/runs",
  authenticate,
  validateRequest({ query: optimisationRunsQuerySchema }),
  getOptimisationRunsHandler
);
router.post(
  "/optimisation/runs",
  authenticate,
  requireRoles(...writeRoles),
  validateRequest({ body: optimisationRunBodySchema }),
  postOptimisationRunHandler
);
router.get(
  "/optimisation/runs/:runId",
  authenticate,
  validateRequest({ params: runIdParamsSchema }),
  getOptimisationRunHandler
);

export default router;
