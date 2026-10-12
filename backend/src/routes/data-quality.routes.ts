import { Router } from "express";
import { z } from "zod";

import {
  getDataQualityHandler,
  patchDataQualityHandler,
  postDataQualityHandler
} from "../controllers/data-quality.controller.js";
import { DATA_QUALITY_TYPES } from "../services/data-quality.service.js";
import { authenticate } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validateRequest.js";

const router = Router();

router.use(authenticate);
router.get("/", getDataQualityHandler);
router.post(
  "/",
  validateRequest({
    body: z.object({
      organisationId: z.string().optional(),
      siteId: z.string().optional(),
      plantId: z.string().optional(),
      exceptionType: z.enum(DATA_QUALITY_TYPES as unknown as [string, ...string[]]),
      title: z.string().min(2).max(240),
      detail: z.string().max(5000).optional(),
      provenance: z.enum(["measured", "forecast", "simulated", "estimated"]).optional(),
      quality: z.enum(["good", "uncertain", "stale", "bad"]).optional()
    })
  }),
  postDataQualityHandler
);
router.patch(
  "/:id",
  validateRequest({
    params: z.object({ id: z.string().min(1) }),
    body: z.object({
      status: z.enum(["open", "quarantined", "resolved", "approved"]).optional(),
      resolutionNotes: z.string().max(5000).optional(),
      approvedByName: z.string().max(120).optional(),
      detail: z.string().max(5000).optional()
    })
  }),
  patchDataQualityHandler
);

export default router;
