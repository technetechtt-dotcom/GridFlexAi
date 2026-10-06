import { Router } from "express";

import { postRecoveryAnalyseHandler } from "../controllers/recovery.controller.js";
import { authenticate } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { recoveryAnalyseBodySchema } from "../schemas/request.schemas.js";

const router = Router();

router.use(authenticate);

router.post(
  "/analyse",
  validateRequest({ body: recoveryAnalyseBodySchema }),
  postRecoveryAnalyseHandler
);

export default router;
