import type { Prisma, Role, AlarmStatus } from "@prisma/client";

import {
  assertOrganisationAccess,
  assertSiteAccess,
  resolveAccessScope,
  type AccessScope
} from "../middleware/permissions.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/AppError.js";
import { notifyAlarmRaised } from "./alarm-notifier.js";
import { recordAuditLog } from "./audit-log.service.js";

export type AlarmActor = { id: string; role: string };

const tenantWhereFromScope = (scope: AccessScope): Prisma.AlarmEventWhereInput => {
  if (scope.kind === "global") return {};
  if (scope.kind === "none") return { organisationId: "__none__" };
  if (scope.kind === "site") {
    return { OR: [{ siteId: { in: scope.siteIds } }, { organisationId: { in: scope.organisationIds } }] };
  }
  return { organisationId: { in: scope.organisationIds } };
};

const ruleWhereFromScope = (scope: AccessScope): Prisma.AlarmRuleWhereInput => {
  if (scope.kind === "global") return {};
  if (scope.kind === "none") return { organisationId: "__none__" };
  if (scope.kind === "site") {
    return { OR: [{ siteId: { in: scope.siteIds } }, { organisationId: { in: scope.organisationIds }, siteId: null }] };
  }
  return { organisationId: { in: scope.organisationIds } };
};

const incidentWhereFromScope = (scope: AccessScope): Prisma.IncidentWhereInput => {
  if (scope.kind === "global") return {};
  if (scope.kind === "none") return { organisationId: "__none__" };
  if (scope.kind === "site") {
    return { OR: [{ siteId: { in: scope.siteIds } }, { organisationId: { in: scope.organisationIds } }] };
  }
  return { organisationId: { in: scope.organisationIds } };
};

const loadScope = async (actor: AlarmActor): Promise<AccessScope> =>
  resolveAccessScope(actor.id, actor.role as Role);

export const alarmEventScopeWhere = tenantWhereFromScope;

export const listAlarmRules = async (actor: AlarmActor) => {
  const scope = await loadScope(actor);
  return prisma.alarmRule.findMany({ where: ruleWhereFromScope(scope), orderBy: [{ updatedAt: "desc" }], take: 200 });
};

export const createAlarmRule = async (
  input: {
    organisationId: string; siteId?: string; plantId?: string; assetId?: string; name: string;
    description?: string; metricKey: string; comparator?: "gt" | "gte" | "lt" | "lte" | "eq" | "neq";
    threshold: number; severity?: "info" | "warning" | "major" | "critical"; enabled?: boolean;
    cooldownSeconds?: number; metadata?: Prisma.InputJsonValue;
  },
  actor: AlarmActor
) => {
  const scope = await loadScope(actor);
  assertOrganisationAccess(scope, input.organisationId);
  if (input.siteId) await assertSiteAccess(scope, input.siteId);
  const data: Prisma.AlarmRuleUncheckedCreateInput = {
    organisationId: input.organisationId, name: input.name, metricKey: input.metricKey, threshold: input.threshold,
    comparator: input.comparator ?? "gt", severity: input.severity ?? "warning", enabled: input.enabled ?? true,
    cooldownSeconds: input.cooldownSeconds ?? 300
  };
  if (input.siteId) data.siteId = input.siteId;
  if (input.plantId) data.plantId = input.plantId;
  if (input.assetId) data.assetId = input.assetId;
  if (input.description) data.description = input.description;
  if (input.metadata !== undefined) data.metadata = input.metadata;
  const rule = await prisma.alarmRule.create({ data });
  await recordAuditLog({ action: "alarm_rule.create", entityType: "AlarmRule", entityId: rule.id, message: rule.name, userId: actor.id, organisationId: rule.organisationId, siteId: rule.siteId ?? undefined });
  return rule;
};

export const listAlarmEvents = async (actor: AlarmActor, filters?: { status?: string; siteId?: string }) => {
  const scope = await loadScope(actor);
  if (filters?.siteId) await assertSiteAccess(scope, filters.siteId);
  const where: Prisma.AlarmEventWhereInput = { ...tenantWhereFromScope(scope) };
  const statusFilter = filters?.status;
  if (statusFilter) where.status = statusFilter as AlarmStatus;
  if (filters?.siteId) where.siteId = filters.siteId;
  return prisma.alarmEvent.findMany({
    where, orderBy: [{ startedAt: "desc" }], take: 200,
    include: { acknowledgements: { orderBy: { acknowledgedAt: "desc" }, take: 5, select: { id: true, userId: true, note: true, acknowledgedAt: true } } }
  });
};

export const raiseAlarmEvent = async (
  input: {
    organisationId: string; siteId: string; plantId?: string; assetId?: string; ruleId?: string;
    severity?: "info" | "warning" | "major" | "critical"; title: string; message: string;
    metricKey?: string; metricValue?: number; threshold?: number; metadata?: Prisma.InputJsonValue;
  },
  actor: AlarmActor
) => {
  const scope = await loadScope(actor);
  assertOrganisationAccess(scope, input.organisationId);
  await assertSiteAccess(scope, input.siteId);
  const data: Prisma.AlarmEventUncheckedCreateInput = {
    organisationId: input.organisationId, siteId: input.siteId, title: input.title, message: input.message,
    severity: input.severity ?? "warning", status: "active"
  };
  if (input.plantId) data.plantId = input.plantId;
  if (input.assetId) data.assetId = input.assetId;
  if (input.ruleId) data.ruleId = input.ruleId;
  if (input.metricKey) data.metricKey = input.metricKey;
  if (typeof input.metricValue === "number") data.metricValue = input.metricValue;
  if (typeof input.threshold === "number") data.threshold = input.threshold;
  if (input.metadata !== undefined) data.metadata = input.metadata;
  const event = await prisma.alarmEvent.create({ data });
  await recordAuditLog({ action: "alarm_event.raise", entityType: "AlarmEvent", entityId: event.id, message: event.title, userId: actor.id, organisationId: event.organisationId, siteId: event.siteId });
  await notifyAlarmRaised({
    alarmEventId: event.id,
    organisationId: event.organisationId,
    siteId: event.siteId,
    severity: event.severity,
    title: event.title,
    message: event.message
  });
  return event;
};

export const acknowledgeAlarmEvent = async (alarmEventId: string, actor: AlarmActor, note?: string) => {
  const scope = await loadScope(actor);
  const event = await prisma.alarmEvent.findUnique({ where: { id: alarmEventId } });
  if (!event) throw new AppError("Alarm event not found.", 404);
  assertOrganisationAccess(scope, event.organisationId);
  await assertSiteAccess(scope, event.siteId);
  const ackData: Prisma.AlarmAcknowledgementUncheckedCreateInput = { alarmEventId, userId: actor.id };
  if (note) ackData.note = note;
  const [acknowledgement] = await prisma.$transaction([
    prisma.alarmAcknowledgement.create({ data: ackData }),
    prisma.alarmEvent.update({ where: { id: alarmEventId }, data: { status: "acknowledged" } })
  ]);
  await recordAuditLog({ action: "alarm_event.acknowledge", entityType: "AlarmEvent", entityId: alarmEventId, message: note ?? "Acknowledged", userId: actor.id, organisationId: event.organisationId, siteId: event.siteId });
  return acknowledgement;
};

export const resolveAlarmEvent = async (alarmEventId: string, actor: AlarmActor, note?: string) => {
  const scope = await loadScope(actor);
  const event = await prisma.alarmEvent.findUnique({ where: { id: alarmEventId } });
  if (!event) throw new AppError("Alarm event not found.", 404);
  assertOrganisationAccess(scope, event.organisationId);
  await assertSiteAccess(scope, event.siteId);

  const metadata =
    note && typeof event.metadata === "object" && event.metadata !== null && !Array.isArray(event.metadata)
      ? { ...(event.metadata as Record<string, unknown>), resolveNote: note }
      : note
        ? { resolveNote: note }
        : event.metadata ?? undefined;

  const updated = await prisma.alarmEvent.update({
    where: { id: alarmEventId },
    data: {
      status: "cleared",
      clearedAt: new Date(),
      ...(metadata !== undefined ? { metadata: metadata as Prisma.InputJsonValue } : {})
    }
  });

  await recordAuditLog({
    action: "alarm_event.resolve",
    entityType: "AlarmEvent",
    entityId: alarmEventId,
    message: note ?? "Resolved",
    userId: actor.id,
    organisationId: event.organisationId,
    siteId: event.siteId
  });
  return updated;
};

export const listIncidents = async (actor: AlarmActor) => {
  const scope = await loadScope(actor);
  return prisma.incident.findMany({
    where: incidentWhereFromScope(scope), orderBy: [{ openedAt: "desc" }], take: 100,
    include: { timeline: { orderBy: { createdAt: "asc" }, take: 20 }, _count: { select: { alarmEvents: true } } }
  });
};

export const createIncident = async (
  input: { organisationId: string; siteId: string; plantId?: string; title: string; summary?: string; severity?: "info" | "warning" | "major" | "critical"; alarmEventIds?: string[] },
  actor: AlarmActor
) => {
  const scope = await loadScope(actor);
  assertOrganisationAccess(scope, input.organisationId);
  await assertSiteAccess(scope, input.siteId);
  const incident = await prisma.$transaction(async (tx) => {
    const createData: Prisma.IncidentUncheckedCreateInput = {
      organisationId: input.organisationId, siteId: input.siteId, title: input.title, severity: input.severity ?? "major", openedById: actor.id,
      timeline: { create: { actorUserId: actor.id, eventType: "opened", message: `Incident opened: ${input.title}` } }
    };
    if (input.plantId) createData.plantId = input.plantId;
    if (input.summary) createData.summary = input.summary;
    const created = await tx.incident.create({ data: createData, include: { timeline: true } });
    if (input.alarmEventIds?.length) {
      await tx.alarmEvent.updateMany({ where: { id: { in: input.alarmEventIds }, organisationId: input.organisationId, siteId: input.siteId }, data: { incidentId: created.id } });
    }
    return created;
  });
  await recordAuditLog({ action: "incident.create", entityType: "Incident", entityId: incident.id, message: incident.title, userId: actor.id, organisationId: incident.organisationId, siteId: incident.siteId });
  return incident;
};

export const appendIncidentTimeline = async (incidentId: string, actor: AlarmActor, input: { eventType: string; message: string; metadata?: Prisma.InputJsonValue }) => {
  const scope = await loadScope(actor);
  const incident = await prisma.incident.findUnique({ where: { id: incidentId } });
  if (!incident) throw new AppError("Incident not found.", 404);
  assertOrganisationAccess(scope, incident.organisationId);
  await assertSiteAccess(scope, incident.siteId);
  const data: Prisma.IncidentTimelineUncheckedCreateInput = { incidentId, actorUserId: actor.id, eventType: input.eventType, message: input.message };
  if (input.metadata !== undefined) data.metadata = input.metadata;
  return prisma.incidentTimeline.create({ data });
};
