import { Router } from "express";

import {
  getActiveRemoteConfigHandler,
  publishRemoteConfigHandler
} from "../controllers/edge-config.controller.js";
import { authenticate, requireRoles } from "../middleware/auth.js";
import { verifyEdgeDeviceAuth } from "../middleware/edgeDeviceAuth.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { publishEdgeRemoteConfigBodySchema } from "../schemas/request.schemas.js";

const router = Router();

/** Device pulls signed config over TLS (auth required; no HMAC secrets in body). */
router.get("/edge/config", verifyEdgeDeviceAuth, getActiveRemoteConfigHandler);

/** Operators publish a new signed configuration version. */
router.post(
  "/edge/config",
  authenticate,
  requireRoles("admin", "developer"),
  validateRequest({ body: publishEdgeRemoteConfigBodySchema }),
  publishRemoteConfigHandler
);

export default router;
