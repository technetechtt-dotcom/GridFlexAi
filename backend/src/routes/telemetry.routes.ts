import { Router } from "express";

import {
  getTelemetryAggregateHandler,
  getTelemetryReadingsHandler,
  postTelemetryBatchHandler
} from "../controllers/telemetry.controller.js";
import { authenticate } from "../middleware/auth.js";
import { verifyEdgeDeviceAuth } from "../middleware/edgeDeviceAuth.js";

const router = Router();

/** Versioned telemetry batch ingest — accepts device HMAC or authenticated admin tooling. */
router.post("/batch", verifyEdgeDeviceAuth, postTelemetryBatchHandler);
router.get("/readings", authenticate, getTelemetryReadingsHandler);
router.get("/series", authenticate, getTelemetryAggregateHandler);

export default router;
