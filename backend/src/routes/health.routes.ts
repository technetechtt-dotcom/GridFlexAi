import { Router } from "express";

import { getHealth, getLiveness } from "../controllers/health.controller.js";
import { prometheusMetricsHandler } from "../controllers/metrics.controller.js";

const router = Router();

router.get("/health/live", getLiveness);
router.get("/health", getHealth);
router.get("/metrics", prometheusMetricsHandler);

export default router;
