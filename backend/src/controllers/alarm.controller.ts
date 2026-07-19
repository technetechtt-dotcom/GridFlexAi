import type { Request, Response } from "express";

import {
  acknowledgeAlarmEvent,
  appendIncidentTimeline,
  createAlarmRule,
  createIncident,
  listAlarmEvents,
  listAlarmRules,
  listIncidents,
  raiseAlarmEvent,
  type AlarmActor
} from "../services/alarm.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";

const requireActor = (req: Request): AlarmActor => {
  if (!req.user) {
    throw new AppError("Authentication required.", 401);
  }
  return { id: req.user.id, role: req.user.role };
};

export const getAlarmRulesHandler = asyncHandler(async (req: Request, res: Response) => {
  const data = await listAlarmRules(requireActor(req));
  res.status(200).json({ data });
});

export const postAlarmRuleHandler = asyncHandler(async (req: Request, res: Response) => {
  const payload: Parameters<typeof createAlarmRule>[0] = {
    organisationId: req.body.organisationId,
    name: req.body.name,
    metricKey: req.body.metricKey,
    threshold: req.body.threshold
  };
  if (typeof req.body.siteId === "string") payload.siteId = req.body.siteId;
  if (typeof req.body.plantId === "string") payload.plantId = req.body.plantId;
  if (typeof req.body.assetId === "string") payload.assetId = req.body.assetId;
  if (typeof req.body.description === "string") payload.description = req.body.description;
  if (typeof req.body.comparator === "string") payload.comparator = req.body.comparator;
  if (typeof req.body.severity === "string") payload.severity = req.body.severity;
  if (typeof req.body.enabled === "boolean") payload.enabled = req.body.enabled;
  if (typeof req.body.cooldownSeconds === "number") payload.cooldownSeconds = req.body.cooldownSeconds;
  if (req.body.metadata !== undefined) payload.metadata = req.body.metadata;

  const data = await createAlarmRule(payload, requireActor(req));
  res.status(201).json({ data });
});

export const getAlarmEventsHandler = asyncHandler(async (req: Request, res: Response) => {
  const filters: { status?: string; siteId?: string } = {};
  if (typeof req.query.status === "string") filters.status = req.query.status;
  if (typeof req.query.siteId === "string") filters.siteId = req.query.siteId;

  const data = await listAlarmEvents(requireActor(req), filters);
  res.status(200).json({ data });
});

export const postAlarmEventHandler = asyncHandler(async (req: Request, res: Response) => {
  const payload: Parameters<typeof raiseAlarmEvent>[0] = {
    organisationId: req.body.organisationId,
    siteId: req.body.siteId,
    title: req.body.title,
    message: req.body.message
  };
  if (typeof req.body.plantId === "string") payload.plantId = req.body.plantId;
  if (typeof req.body.assetId === "string") payload.assetId = req.body.assetId;
  if (typeof req.body.ruleId === "string") payload.ruleId = req.body.ruleId;
  if (typeof req.body.severity === "string") payload.severity = req.body.severity;
  if (typeof req.body.metricKey === "string") payload.metricKey = req.body.metricKey;
  if (typeof req.body.metricValue === "number") payload.metricValue = req.body.metricValue;
  if (typeof req.body.threshold === "number") payload.threshold = req.body.threshold;
  if (req.body.metadata !== undefined) payload.metadata = req.body.metadata;

  const data = await raiseAlarmEvent(payload, requireActor(req));
  res.status(201).json({ data });
});

export const postAcknowledgeAlarmEventHandler = asyncHandler(async (req: Request, res: Response) => {
  const alarmEventId = req.params.alarmEventId;
  if (!alarmEventId) throw new AppError("alarmEventId is required.", 400);

  const note = typeof req.body.note === "string" ? req.body.note : undefined;
  const data = await acknowledgeAlarmEvent(alarmEventId, requireActor(req), note);
  res.status(201).json({ data });
});

export const getIncidentsHandler = asyncHandler(async (req: Request, res: Response) => {
  const data = await listIncidents(requireActor(req));
  res.status(200).json({ data });
});

export const postIncidentHandler = asyncHandler(async (req: Request, res: Response) => {
  const payload: Parameters<typeof createIncident>[0] = {
    organisationId: req.body.organisationId,
    siteId: req.body.siteId,
    title: req.body.title
  };
  if (typeof req.body.plantId === "string") payload.plantId = req.body.plantId;
  if (typeof req.body.summary === "string") payload.summary = req.body.summary;
  if (typeof req.body.severity === "string") payload.severity = req.body.severity;
  if (Array.isArray(req.body.alarmEventIds)) payload.alarmEventIds = req.body.alarmEventIds;

  const data = await createIncident(payload, requireActor(req));
  res.status(201).json({ data });
});

export const postIncidentTimelineHandler = asyncHandler(async (req: Request, res: Response) => {
  const incidentId = req.params.incidentId;
  if (!incidentId) throw new AppError("incidentId is required.", 400);

  const timelineInput: Parameters<typeof appendIncidentTimeline>[2] = {
    eventType: req.body.eventType,
    message: req.body.message
  };
  if (req.body.metadata !== undefined) timelineInput.metadata = req.body.metadata;

  const data = await appendIncidentTimeline(incidentId, requireActor(req), timelineInput);
  res.status(201).json({ data });
});
