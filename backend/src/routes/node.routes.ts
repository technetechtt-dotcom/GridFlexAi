import { Router } from "express";

import {
  getNode,
  getNodes,
  patchNode,
  postNode,
  postNodeBulkAction,
  postNodeMaintenanceRequest,
  removeNode
} from "../controllers/node.controller.js";
import { authenticate, requireRoles } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validateRequest.js";
import {
  maintenanceRequestBodySchema,
  nodeBodySchema,
  nodeBulkActionBodySchema,
  nodeQuerySchema,
  nodeUpdateBodySchema
} from "../schemas/request.schemas.js";

const router = Router();

router.use(authenticate);

router.get("/", validateRequest({ query: nodeQuerySchema }), getNodes);
router.post(
  "/bulk-actions",
  requireRoles("admin", "developer"),
  validateRequest({ body: nodeBulkActionBodySchema }),
  postNodeBulkAction
);
router.post(
  "/",
  requireRoles("admin", "developer"),
  validateRequest({ body: nodeBodySchema }),
  postNode
);
router.get("/:id", getNode);
router.patch(
  "/:id",
  requireRoles("admin", "developer"),
  validateRequest({ body: nodeUpdateBodySchema }),
  patchNode
);
router.delete("/:id", requireRoles("admin", "developer"), removeNode);
router.post(
  "/:id/maintenance-requests",
  validateRequest({ body: maintenanceRequestBodySchema }),
  postNodeMaintenanceRequest
);

export default router;
