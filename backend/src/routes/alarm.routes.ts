import { Router } from "express";

import {
  getAlarmEvents, getAlarmRules, getIncidents, postAcknowledgeAlarm, postAlarmEvent,
  postAlarmRule, postIncident, postIncidentTimeline
} from "../controllers/alarm.controller.js";
import { authenticate, requireRoles } from "../middleware/auth.js";

const router = Router();
const alarmRoles = ["operator", "manager", "admin", "developer"] as const;

router.use(authenticate);

router.get("/alarm-rules", requireRoles(...alarmRoles), getAlarmRules);
router.post("/alarm-rules", requireRoles(...alarmRoles), postAlarmRule);
router.get("/alarm-events", requireRoles(...alarmRoles), getAlarmEvents);
router.post("/alarm-events", requireRoles(...alarmRoles), postAlarmEvent);
router.post("/alarm-events/:alarmEventId/acknowledge", requireRoles(...alarmRoles), postAcknowledgeAlarm);
router.get("/incidents", requireRoles(...alarmRoles), getIncidents);
router.post("/incidents", requireRoles(...alarmRoles), postIncident);
router.post("/incidents/:incidentId/timeline", requireRoles(...alarmRoles), postIncidentTimeline);

export default router;
