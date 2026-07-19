import { Router } from "express";
import { z } from "zod";

import {
  getCommandHandler,
  getCommandsHandler,
  postApproveCommandHandler,
  postCancelCommandHandler,
  postCommandHandler,
  postExecuteCommandHandler,
  postOverrideCommandHandler,
  postRejectCommandHandler,
  postSubmitCommandHandler
} from "../controllers/command.controller.js";
import { MEASUREMENT_UNITS } from "../domain/provenance.js";
import { COMMAND_OVERRIDE_STATES, COMMAND_REQUEST_STATUSES, COMMAND_RISK_LEVELS, COMMAND_SOURCES } from "../domain/commands.js";
import { authenticate, requireRoles } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validateRequest.js";

const createBodySchema = z.object({
  organisationId: z.string().min(1),
  siteId: z.string().min(1),
  plantId: z.string().min(1),
  targetAssetId: z.string().min(1),
  commandType: z.string().min(1).max(120),
  requestedValue: z.coerce.number(),
  unit: z.enum(MEASUREMENT_UNITS),
  currentValue: z.coerce.number().optional(),
  minimumAllowed: z.coerce.number().optional(),
  maximumAllowed: z.coerce.number().optional(),
  maxRampPerMinute: z.coerce.number().positive().optional(),
  reason: z.string().min(3).max(2000),
  source: z.enum(COMMAND_SOURCES).optional(),
  riskLevel: z.enum(COMMAND_RISK_LEVELS).optional(),
  requireSeparationOfDuties: z.boolean().optional(),
  optimisationRunId: z.string().optional(),
  expiresAt: z.string().datetime(),
  advisoryOnly: z.boolean().optional(),
  metadata: z.unknown().optional()
});

const reasonBodySchema = z.object({
  reason: z.string().max(2000).optional()
});

const cancelBodySchema = z.object({
  reason: z.string().max(2000).optional(),
  emergency: z.boolean().optional()
});

const overrideBodySchema = z.object({
  overrideState: z.enum(COMMAND_OVERRIDE_STATES)
});

const listQuerySchema = z.object({
  status: z.enum(COMMAND_REQUEST_STATUSES).optional(),
  plantId: z.string().optional(),
  siteId: z.string().optional()
});

const router = Router();

router.get(
  "/commands",
  authenticate,
  validateRequest({ query: listQuerySchema }),
  getCommandsHandler
);
router.get("/commands/:id", authenticate, getCommandHandler);
router.post(
  "/commands",
  authenticate,
  requireRoles("admin", "developer", "manager", "operator"),
  validateRequest({ body: createBodySchema }),
  postCommandHandler
);
router.post(
  "/commands/:id/submit",
  authenticate,
  requireRoles("admin", "developer", "manager", "operator"),
  postSubmitCommandHandler
);
router.post(
  "/commands/:id/approve",
  authenticate,
  requireRoles("admin", "developer", "manager"),
  validateRequest({ body: reasonBodySchema }),
  postApproveCommandHandler
);
router.post(
  "/commands/:id/reject",
  authenticate,
  requireRoles("admin", "developer", "manager"),
  validateRequest({ body: reasonBodySchema }),
  postRejectCommandHandler
);
router.post(
  "/commands/:id/cancel",
  authenticate,
  requireRoles("admin", "developer", "manager", "operator"),
  validateRequest({ body: cancelBodySchema }),
  postCancelCommandHandler
);
router.post(
  "/commands/:id/override",
  authenticate,
  requireRoles("admin", "developer"),
  validateRequest({ body: overrideBodySchema }),
  postOverrideCommandHandler
);
router.post(
  "/commands/:id/execute",
  authenticate,
  requireRoles("admin", "developer", "manager"),
  postExecuteCommandHandler
);

export default router;
