import { Router } from "express";
import { z } from "zod";

import {
  getCongestionNodesController,
  getDynamicLineRatingsController,
  getHydrogenTwinController,
  getPilotReportController,
  getTopologyOptimizationController
} from "../controllers/simulation.controller.js";
import {
  getSimulationRunHandler,
  getSimulationRunsHandler,
  postSimulationRunHandler,
  postStopSimulationRunHandler
} from "../controllers/simulation-run.controller.js";
import {
  getOperatingModeHandler,
  postSimulationTelemetryHandler
} from "../controllers/operating-mode.controller.js";
import { authenticate, requireRoles } from "../middleware/auth.js";
import { attachAccessScope } from "../middleware/permissions.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { simulationCongestionBodySchema } from "../schemas/request.schemas.js";

const router = Router();
const createRunBodySchema = z.object({
  organisationId: z.string().min(1),
  siteId: z.string().min(1),
  targetNodeId: z.string().min(1)
}).strict();
const listRunsQuerySchema = z.object({
  siteId: z.string().min(1).optional(),
  status: z.enum(["running", "stopped", "failed"]).optional()
});

/** Public — UI must know mode before authenticating to show the banner on login. */
router.get("/operating-mode", getOperatingModeHandler);

router.use(authenticate);
router.get(
  "/runs",
  attachAccessScope,
  validateRequest({ query: listRunsQuerySchema }),
  getSimulationRunsHandler
);
router.post(
  "/runs",
  attachAccessScope,
  requireRoles("admin", "developer", "manager", "operator"),
  validateRequest({ body: createRunBodySchema }),
  postSimulationRunHandler
);
router.get("/runs/:runId", attachAccessScope, getSimulationRunHandler);
router.post(
  "/runs/:runId/stop",
  attachAccessScope,
  requireRoles("admin", "developer", "manager", "operator"),
  postStopSimulationRunHandler
);
router.post("/telemetry", postSimulationTelemetryHandler);
router.get("/dynamic-line-ratings", getDynamicLineRatingsController);
router.post(
  "/congestion-nodes",
  validateRequest({ body: simulationCongestionBodySchema }),
  getCongestionNodesController
);
router.get("/get-optimization", getTopologyOptimizationController);
router.get("/hydrogen-twin", getHydrogenTwinController);
router.get("/pilot-report", getPilotReportController);

export default router;
