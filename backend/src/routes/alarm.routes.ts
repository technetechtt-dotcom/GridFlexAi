import { Router } from "express";
import { z } from "zod";

import {
  getAlarmEvents,
  getAlarmRules,
  getIncidents,
  postAcknowledgeAlarm,
  postAlarmEvent,
  postAlarmRule,
  postIncident,
  postIncidentTimeline,
  postResolveAlarm
} from "../controllers/alarm.controller.js";
import { authenticate, requireRoles } from "../middleware/auth.js";
import { attachAccessScope } from "../middleware/permissions.js";
import { validateRequest } from "../middleware/validateRequest.js";

const router = Router();
const alarmRoles = ["operator", "manager", "admin", "developer"] as const;

const alarmEventIdParamsSchema = z.object({
  alarmEventId: z.string().min(1)
});

const incidentIdParamsSchema = z.object({
  incidentId: z.string().min(1)
});

const alarmEventsQuerySchema = z.object({
  status: z.enum(["active", "acknowledged", "cleared", "suppressed"]).optional(),
  siteId: z.string().min(1).optional()
});

const alarmRuleBodySchema = z.object({
  organisationId: z.string().min(1),
  siteId: z.string().min(1).optional(),
  plantId: z.string().min(1).optional(),
  assetId: z.string().min(1).optional(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  metricKey: z.string().min(1).max(120),
  comparator: z.enum(["gt", "gte", "lt", "lte", "eq", "neq"]).optional(),
  threshold: z.coerce.number().finite(),
  severity: z.enum(["info", "warning", "major", "critical"]).optional(),
  enabled: z.boolean().optional(),
  cooldownSeconds: z.coerce.number().int().min(0).max(86400).optional(),
  metadata: z.record(z.unknown()).optional()
});

const alarmEventBodySchema = z.object({
  organisationId: z.string().min(1),
  siteId: z.string().min(1),
  plantId: z.string().min(1).optional(),
  assetId: z.string().min(1).optional(),
  ruleId: z.string().min(1).optional(),
  severity: z.enum(["info", "warning", "major", "critical"]).optional(),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(4000),
  metricKey: z.string().min(1).max(120).optional(),
  metricValue: z.coerce.number().finite().optional(),
  threshold: z.coerce.number().finite().optional(),
  metadata: z.record(z.unknown()).optional()
});

const alarmAckBodySchema = z.object({
  note: z.string().max(2000).optional()
});

const alarmResolveBodySchema = z.object({
  note: z.string().max(2000).optional()
});

const incidentBodySchema = z.object({
  organisationId: z.string().min(1),
  siteId: z.string().min(1),
  plantId: z.string().min(1).optional(),
  title: z.string().min(1).max(200),
  summary: z.string().max(4000).optional(),
  severity: z.enum(["info", "warning", "major", "critical"]).optional(),
  alarmEventIds: z.array(z.string().min(1)).max(50).optional()
});

const incidentTimelineBodySchema = z.object({
  eventType: z.string().min(1).max(120),
  message: z.string().min(1).max(4000),
  metadata: z.record(z.unknown()).optional()
});

router.use(authenticate, attachAccessScope);

router.get("/alarm-rules", requireRoles(...alarmRoles), getAlarmRules);
router.post(
  "/alarm-rules",
  requireRoles(...alarmRoles),
  validateRequest({ body: alarmRuleBodySchema }),
  postAlarmRule
);
router.get(
  "/alarm-events",
  requireRoles(...alarmRoles),
  validateRequest({ query: alarmEventsQuerySchema }),
  getAlarmEvents
);
router.post(
  "/alarm-events",
  requireRoles(...alarmRoles),
  validateRequest({ body: alarmEventBodySchema }),
  postAlarmEvent
);
router.post(
  "/alarm-events/:alarmEventId/acknowledge",
  requireRoles(...alarmRoles),
  validateRequest({ params: alarmEventIdParamsSchema, body: alarmAckBodySchema }),
  postAcknowledgeAlarm
);
router.post(
  "/alarm-events/:alarmEventId/resolve",
  requireRoles(...alarmRoles),
  validateRequest({ params: alarmEventIdParamsSchema, body: alarmResolveBodySchema }),
  postResolveAlarm
);
router.get("/incidents", requireRoles(...alarmRoles), getIncidents);
router.post(
  "/incidents",
  requireRoles(...alarmRoles),
  validateRequest({ body: incidentBodySchema }),
  postIncident
);
router.post(
  "/incidents/:incidentId/timeline",
  requireRoles(...alarmRoles),
  validateRequest({ params: incidentIdParamsSchema, body: incidentTimelineBodySchema }),
  postIncidentTimeline
);

export default router;
