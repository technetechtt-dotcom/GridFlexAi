import { Router } from "express";

import {
  getCongestionNodesController,
  getDynamicLineRatingsController,
  getHydrogenTwinController,
  getPilotReportController,
  getTopologyOptimizationController
} from "../controllers/simulation.controller.js";
import { authenticate } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { simulationCongestionBodySchema } from "../schemas/request.schemas.js";

const router = Router();

router.use(authenticate);
router.get("/dynamic-line-ratings", getDynamicLineRatingsController);
router.post("/congestion-nodes", validateRequest({ body: simulationCongestionBodySchema }), getCongestionNodesController);
router.get("/get-optimization", getTopologyOptimizationController);
router.get("/hydrogen-twin", getHydrogenTwinController);
router.get("/pilot-report", getPilotReportController);

export default router;
