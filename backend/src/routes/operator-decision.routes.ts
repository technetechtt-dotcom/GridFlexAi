import { Router } from "express";
import { z } from "zod";

import {
  getOperatorDecisionsHandler,
  postOperatorDecisionHandler
} from "../controllers/operator-decision.controller.js";
import { authenticate } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { OPERATOR_DECISION_VALUES } from "../services/operator-decision.service.js";

const createDecisionBodySchema = z.object({
  entityType: z.string().min(1).max(80),
  entityId: z.string().min(1).max(120),
  title: z.string().min(1).max(240),
  decision: z.enum(OPERATOR_DECISION_VALUES),
  reason: z.string().min(1).max(2000),
  conditions: z.string().max(2000).optional(),
  assignedReviewer: z.string().max(160).optional(),
  expectedOutcome: z.string().max(2000).optional(),
  previousState: z.string().max(120).optional(),
  newState: z.string().max(120).optional(),
  relatedAlarmId: z.string().optional(),
  relatedRecoveryCaseId: z.string().optional(),
  modelVersion: z.string().max(120).optional(),
  organisationId: z.string().optional(),
  siteId: z.string().optional(),
  metadata: z.record(z.unknown()).optional()
});

const listDecisionsQuerySchema = z.object({
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional()
});

const router = Router();

router.post(
  "/",
  authenticate,
  validateRequest({ body: createDecisionBodySchema }),
  postOperatorDecisionHandler
);

router.get(
  "/",
  authenticate,
  validateRequest({ query: listDecisionsQuerySchema }),
  getOperatorDecisionsHandler
);

export default router;
