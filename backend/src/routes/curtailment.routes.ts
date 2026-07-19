import { Router } from "express";

import {
  getCurtailmentEventHandler,
  getCurtailmentEventsHandler,
  getCurtailmentSummaryHandler,
  patchReviewCurtailmentHandler,
  postCurtailmentCorrectionHandler,
  postDetectCurtailmentHandler
} from "../controllers/curtailment.controller.js";
import { authenticate, requireRoles } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validateRequest.js";
import {
  curtailmentCorrectionBodySchema,
  curtailmentDetectBodySchema,
  curtailmentEventsQuerySchema,
  curtailmentReviewBodySchema
} from "../schemas/request.schemas.js";

const router = Router();

router.use(authenticate);

router.get("/events", validateRequest({ query: curtailmentEventsQuerySchema }), getCurtailmentEventsHandler);
router.get("/summary", getCurtailmentSummaryHandler);
router.get("/events/:eventId", getCurtailmentEventHandler);
router.post(
  "/detect",
  requireRoles("admin", "developer", "manager"),
  validateRequest({ body: curtailmentDetectBodySchema }),
  postDetectCurtailmentHandler
);
router.patch(
  "/events/:eventId/review",
  requireRoles("admin", "developer", "manager", "operator"),
  validateRequest({ body: curtailmentReviewBodySchema }),
  patchReviewCurtailmentHandler
);
router.post(
  "/events/:eventId/corrections",
  requireRoles("admin", "developer", "manager", "operator"),
  validateRequest({ body: curtailmentCorrectionBodySchema }),
  postCurtailmentCorrectionHandler
);

export default router;
