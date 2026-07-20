import { Router } from "express";
import { z } from "zod";

import {
  getAlarmEventsHandler,
  getAlarmRulesHandler,
  getIncidentsHandler,
  postAcknowledgeAlarmEventHandler,
  postAlarmEventHandler,
  postAlarmRuleHandler,
  postIncidentHandler,
  postIncidentTimelineHandler
} from "../controllers/alarm.controller.js";
import { authenticate, requireRoles } from "../middleware/auth.js";
import { attachAccessScope } from "../middleware/permissions.js";
import { validateRequest } from "../middleware/validateRequest.js";

const alarmRuleBodySchema = z.object({
  organisationId: z.string().min(1),
  siteId: z.string().optional(),
  plantId: z.string().optional(),
  assetId: z.string().optional(),
  name: z.string().min(2).max(120),
  description: z.string().max(500).optional(),
  metricKey: z.string().min(1).max(120),
  comparator: z.enum(["gt", "gte", "lt", "lte", "eq", "neq"]).optional(),
  threshold: z.coerce.number(),
  severity: z.enum(["info", "warning", "major", "critical"]).optional(),
  enabled: z.boolean().optional(),
  cooldownSeconds: z.coerce.number().int().min(0).max(86400).optional(),
  metadata: z.unknown().optional()
});

const alarmEventBodySchema = z.object({
  organisationId: z.string().min(1),
  siteId: z.string().min(1),
  plantId: z.string().optional(),
  assetId: z.string().optional(),
  ruleId: z.string().optional(),
  severity: z.enum(["info", "warning", "major", "critical"]).optional(),
  title: z.string().min(2).max(200),
  message: z.string().min(1).max(2000),
  metricKey: z.string().optional(),
  metricValue: z.coerce.number().optional(),
  threshold: z.coerce.number().optional(),
  metadata: z.unknown().optional()
});

const alarmEventsQuerySchema = z.object({
  status: z.enum(["active", "acknowledged", "cleared", "suppressed"]).optional(),
  siteId: z.string().optional()
});

const acknowledgeBodySchema = z.object({
  note: z.string().max(1000).optional()
});

const incidentBodySchema = z.object({
  organisationId: z.string().min(1),
  siteId: z.string().min(1),
  plantId: z.string().optional(),
  title: z.string().min(2).max(200),
  summary: z.string().max(2000).optional(),
  severity: z.enum(["info", "warning", "major", "critical"]).optional(),
  alarmEventIds: z.array(z.string().min(1)).optional()
});

const incidentTimelineBodySchema = z.object({
  eventType: z.string().min(1).max(80),
  message: z.string().min(1).max(2000),
  metadata: z.unknown().optional()
});

const router = Router();

// Authenticate per-route only. Do not use router.use(authenticate) when this
// router is mounted at "/", or it will intercept unrelated paths (e.g. /edge-data).
const scoped = [authenticate, attachAccessScope] as const;

router.get("/alarm-rules", ...scoped, getAlarmRulesHandler);
router.post(
  "/alarm-rules",
  ...scoped,
  requireRoles("admin", "developer", "manager"),
  validateRequest({ body: alarmRuleBodySchema }),
  postAlarmRuleHandler
);

router.get(
  "/alarm-events",
  ...scoped,
  validateRequest({ query: alarmEventsQuerySchema }),
  getAlarmEventsHandler
);
router.post(
  "/alarm-events",
  ...scoped,
  requireRoles("admin", "developer", "manager", "operator"),
  validateRequest({ body: alarmEventBodySchema }),
  postAlarmEventHandler
);
router.post(
  "/alarm-events/:alarmEventId/acknowledge",
  ...scoped,
  requireRoles("admin", "developer", "manager", "operator"),
  validateRequest({ body: acknowledgeBodySchema }),
  postAcknowledgeAlarmEventHandler
);

router.get("/incidents", ...scoped, getIncidentsHandler);
router.post(
  "/incidents",
  ...scoped,
  requireRoles("admin", "developer", "manager", "operator"),
  validateRequest({ body: incidentBodySchema }),
  postIncidentHandler
);
router.post(
  "/incidents/:incidentId/timeline",
  ...scoped,
  requireRoles("admin", "developer", "manager", "operator"),
  validateRequest({ body: incidentTimelineBodySchema }),
  postIncidentTimelineHandler
);

export default router;
