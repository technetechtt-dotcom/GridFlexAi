import { Router } from "express";

import {
  getRecoveryAnalysesHandler,
  getRecoveryAnalysisHandler,
  getRecoveryReportHandler,
  patchRecoveryReviewHandler,
  postRecoveryAnalyseHandler,
  postRecoveryAnalysePlantHandler
} from "../controllers/recovery.controller.js";
import { authenticate, requireRoles } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validateRequest.js";
import {
  recoveryAnalyseBodySchema,
  recoveryAnalysePlantBodySchema,
  recoveryListQuerySchema,
  recoveryReviewBodySchema
} from "../schemas/request.schemas.js";

const router = Router();

router.use(authenticate);

router.post(
  "/analyse",
  validateRequest({ body: recoveryAnalyseBodySchema }),
  postRecoveryAnalyseHandler
);

router.post(
  "/analyse-plant",
  requireRoles("admin", "developer", "manager", "operator"),
  validateRequest({ body: recoveryAnalysePlantBodySchema }),
  postRecoveryAnalysePlantHandler
);

router.get(
  "/analyses",
  validateRequest({ query: recoveryListQuerySchema }),
  getRecoveryAnalysesHandler
);

router.get("/analyses/:analysisId", getRecoveryAnalysisHandler);
router.get("/analyses/:analysisId/report", getRecoveryReportHandler);

router.patch(
  "/analyses/:analysisId/review",
  requireRoles("admin", "developer", "manager", "operator"),
  validateRequest({ body: recoveryReviewBodySchema }),
  patchRecoveryReviewHandler
);

export default router;
