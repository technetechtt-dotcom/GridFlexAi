import { Router } from "express";

import {
  getTeamActivityHandler,
  getTeamOverviewHandler,
  postManagedOperatorHandler
} from "../controllers/team.controller.js";
import { authenticate, requireRoles } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { createManagedOperatorBodySchema } from "../schemas/request.schemas.js";

const router = Router();

router.use(authenticate, requireRoles("manager"));

router.get("/overview", getTeamOverviewHandler);
router.post(
  "/operators",
  validateRequest({ body: createManagedOperatorBodySchema }),
  postManagedOperatorHandler
);
router.get("/activity", getTeamActivityHandler);

export default router;
