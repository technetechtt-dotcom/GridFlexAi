import { Router } from "express";

import {
  getCongestionNodesController,
  getDynamicLineRatingsController,
  getHydrogenTwinController,
  getPilotReportController,
  getTopologyOptimizationController
} from "../controllers/simulation.controller.js";
import {
  getOperatingModeHandler,
  postSimulationTelemetryHandler
} from "../controllers/operating-mode.controller.js";
import { authenticate } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { simulationCongestionBodySchema } from "../schemas/request.schemas.js";

const router = Router();

/** Public — UI must know mode before authenticating to show the banner on login. */
router.get("/operating-mode", getOperatingModeHandler);

router.use(authenticate);
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
