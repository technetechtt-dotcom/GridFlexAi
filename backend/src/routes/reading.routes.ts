import { Router } from "express";

import { getReadingsSummaryController, ingestEdgeData, listReadings } from "../controllers/reading.controller.js";
import { authenticate } from "../middleware/auth.js";
import { verifyEdgeDeviceAuth } from "../middleware/edgeDeviceAuth.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { edgeDataBodySchema, readingsQuerySchema, readingsSummaryQuerySchema } from "../schemas/request.schemas.js";

const router = Router();

router.get("/readings", authenticate, validateRequest({ query: readingsQuerySchema }), listReadings);
router.get(
  "/readings/summary",
  authenticate,
  validateRequest({ query: readingsSummaryQuerySchema }),
  getReadingsSummaryController
);
router.post("/edge-data", verifyEdgeDeviceAuth, validateRequest({ body: edgeDataBodySchema }), ingestEdgeData);

export default router;
