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
  resolveAlarmEvent
} from "../services/alarm.service.js";
import { AppError } from "../utils/AppError.js";

const actorFrom = (req: Request) => {
  if (!req.user) throw new AppError("Authentication required.", 401);
  return { id: req.user.id, role: req.user.role };
};

const body = (req: Request): Record<string, unknown> =>
  typeof req.body === "object" && req.body !== null ? (req.body as Record<string, unknown>) : {};

export const getAlarmRules = async (req: Request, res: Response) => {
  res.json({ data: await listAlarmRules(actorFrom(req)) });
};

export const postAlarmRule = async (req: Request, res: Response) => {
  const b = body(req);
  const payload: Parameters<typeof createAlarmRule>[0] = {
    organisationId: String(b.organisationId),
    name: String(b.name),
    metricKey: String(b.metricKey),
    threshold: Number(b.threshold)
  };
  if (b.siteId) payload.siteId = String(b.siteId);
  if (b.plantId) payload.plantId = String(b.plantId);
  if (b.assetId) payload.assetId = String(b.assetId);
  if (b.description) payload.description = String(b.description);
  if (b.comparator) {
    payload.comparator = String(b.comparator) as NonNullable<
      Parameters<typeof createAlarmRule>[0]["comparator"]
    >;
  }
  if (b.severity) {
    payload.severity = String(b.severity) as NonNullable<
      Parameters<typeof createAlarmRule>[0]["severity"]
    >;
  }
  if (typeof b.enabled === "boolean") payload.enabled = b.enabled;
  if (typeof b.cooldownSeconds === "number") payload.cooldownSeconds = b.cooldownSeconds;
  if (b.metadata !== undefined) payload.metadata = b.metadata as never;
  res.status(201).json({ data: await createAlarmRule(payload, actorFrom(req)) });
};

export const getAlarmEvents = async (req: Request, res: Response) => {
  const { status, siteId } = req.query;
  const filters: { status?: string; siteId?: string } = {};
  if (typeof status === "string") filters.status = status;
  if (typeof siteId === "string") filters.siteId = siteId;
  res.json({ data: await listAlarmEvents(actorFrom(req), filters) });
};

export const postAlarmEvent = async (req: Request, res: Response) => {
  const b = body(req);
  const payload: Parameters<typeof raiseAlarmEvent>[0] = {
    organisationId: String(b.organisationId),
    siteId: String(b.siteId),
    title: String(b.title),
    message: String(b.message)
  };
  if (b.plantId) payload.plantId = String(b.plantId);
  if (b.assetId) payload.assetId = String(b.assetId);
  if (b.ruleId) payload.ruleId = String(b.ruleId);
  if (b.severity) {
    payload.severity = String(b.severity) as NonNullable<
      Parameters<typeof raiseAlarmEvent>[0]["severity"]
    >;
  }
  if (b.metricKey) payload.metricKey = String(b.metricKey);
  if (typeof b.metricValue === "number") payload.metricValue = b.metricValue;
  if (typeof b.threshold === "number") payload.threshold = b.threshold;
  if (b.metadata !== undefined) payload.metadata = b.metadata as never;
  res.status(201).json({ data: await raiseAlarmEvent(payload, actorFrom(req)) });
};

export const postAcknowledgeAlarm = async (req: Request, res: Response) => {
  const b = body(req);
  const alarmEventId = req.params.alarmEventId;
  if (!alarmEventId) throw new AppError("Alarm event id is required.", 400);
  res.status(201).json({
    data: await acknowledgeAlarmEvent(
      alarmEventId,
      actorFrom(req),
      b.note ? String(b.note) : undefined
    )
  });
};

export const postResolveAlarm = async (req: Request, res: Response) => {
  const b = body(req);
  const alarmEventId = req.params.alarmEventId;
  if (!alarmEventId) throw new AppError("Alarm event id is required.", 400);
  res.status(200).json({
    data: await resolveAlarmEvent(
      alarmEventId,
      actorFrom(req),
      b.note ? String(b.note) : undefined
    )
  });
};

export const getIncidents = async (req: Request, res: Response) => {
  res.json({ data: await listIncidents(actorFrom(req)) });
};

export const postIncident = async (req: Request, res: Response) => {
  const b = body(req);
  const payload: Parameters<typeof createIncident>[0] = {
    organisationId: String(b.organisationId),
    siteId: String(b.siteId),
    title: String(b.title)
  };
  if (b.plantId) payload.plantId = String(b.plantId);
  if (b.summary) payload.summary = String(b.summary);
  if (b.severity) {
    payload.severity = String(b.severity) as NonNullable<
      Parameters<typeof createIncident>[0]["severity"]
    >;
  }
  if (Array.isArray(b.alarmEventIds)) payload.alarmEventIds = b.alarmEventIds.map(String);
  res.status(201).json({ data: await createIncident(payload, actorFrom(req)) });
};

export const postIncidentTimeline = async (req: Request, res: Response) => {
  const b = body(req);
  const incidentId = req.params.incidentId;
  if (!incidentId) throw new AppError("Incident id is required.", 400);
  res.status(201).json({
    data: await appendIncidentTimeline(incidentId, actorFrom(req), {
      eventType: String(b.eventType),
      message: String(b.message),
      metadata: b.metadata as never
    })
  });
};
