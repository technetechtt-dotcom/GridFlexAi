import { Router } from "express";

import {
  deleteGridConstraintHandler,
  getGridConstraintsHandler,
  patchGridConstraintHandler,
  postGridConstraintHandler
} from "../controllers/grid-constraint.controller.js";
import { authenticate, requireRoles } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validateRequest.js";
import {
  gridConstraintBodySchema,
  gridConstraintQuerySchema,
  gridConstraintUpdateBodySchema
} from "../schemas/request.schemas.js";

const router = Router();

router.use(authenticate);

router.get("/", validateRequest({ query: gridConstraintQuerySchema }), getGridConstraintsHandler);
router.post(
  "/",
  requireRoles("admin", "developer", "manager"),
  validateRequest({ body: gridConstraintBodySchema }),
  postGridConstraintHandler
);
router.patch(
  "/:constraintId",
  requireRoles("admin", "developer", "manager"),
  validateRequest({ body: gridConstraintUpdateBodySchema }),
  patchGridConstraintHandler
);
router.delete(
  "/:constraintId",
  requireRoles("admin", "developer"),
  deleteGridConstraintHandler
);

export default router;
