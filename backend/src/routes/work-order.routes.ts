import { Router } from "express";
import { z } from "zod";

import {
  getWorkOrdersHandler,
  patchWorkOrderHandler,
  postWorkOrderHandler
} from "../controllers/work-order.controller.js";
import { authenticate } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validateRequest.js";

const createBodySchema = z.object({
  title: z.string().min(2).max(240),
  description: z.string().max(5000).optional(),
  priority: z.enum(["low", "normal", "high", "urgent", "critical"]).optional(),
  assigneeUserId: z.string().optional(),
  dueAt: z.string().datetime().optional(),
  organisationId: z.string().optional(),
  siteId: z.string().optional(),
  relatedEntityType: z.string().max(80).optional(),
  relatedEntityId: z.string().max(120).optional(),
  notes: z.string().max(5000).optional(),
  evidence: z.array(z.string().max(500)).max(20).optional()
});

const patchBodySchema = z.object({
  status: z
    .enum(["open", "assigned", "in_progress", "blocked", "escalated", "completed", "closed"])
    .optional(),
  priority: z.enum(["low", "normal", "high", "urgent", "critical"]).optional(),
  assigneeUserId: z.string().nullable().optional(),
  notes: z.string().max(5000).optional(),
  description: z.string().max(5000).optional(),
  dueAt: z.string().datetime().nullable().optional(),
  completionNotes: z.string().max(5000).optional(),
  evidence: z.array(z.string().max(500)).max(20).optional(),
  approvalStatus: z.enum(["none", "pending", "approved", "rejected"]).optional(),
  escalate: z.boolean().optional()
});

const router = Router();

router.use(authenticate);
router.get("/", getWorkOrdersHandler);
router.post("/", validateRequest({ body: createBodySchema }), postWorkOrderHandler);
router.patch(
  "/:id",
  validateRequest({ params: z.object({ id: z.string().min(1) }), body: patchBodySchema }),
  patchWorkOrderHandler
);

export default router;
