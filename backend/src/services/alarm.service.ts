import type { Prisma } from "@prisma/client";
import type { Role } from "@prisma/client";

import {
  assertOrganisationAccess,
  assertSiteAccess,
  resolveAccessScope,
  type AccessScope
} from "../middleware/permissions.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/AppError.js";
import { recordAuditLog } from "./audit-log.service.js";

export type AlarmActor = {
  id: string;
  role: string;
};

const tenantWhereFromScope = (scope: AccessScope): Prisma.AlarmEventWhereInput => {
  if (scope.kind === "global") return {};
  if (scope.kind === "none") return { organisationId: "__none__" };
  if (scope.kind === "site") {
    return { siteId: { in: scope.siteIds } };
  }
  return { organisationId: { in: scope.organisationIds } };
};

const ruleWhereFromScope = (scope: AccessScope): Prisma.AlarmRuleWhereInput => {
  if (scope.kind === "global") return {};
  if (scope.kind === "none") return { organisationId: "__none__" };
  if (scope.kind === "site") {
    return {
      OR: [
        { siteId: { in: scope.siteIds } },
        { organisationId: { in: scope.organisationIds }, siteId: null }
      ]
    };
  }
  return { organisationId: { in: scope.organisationIds } };
};

const incidentWhereFromScope = (scope: AccessScope): Prisma.IncidentWhereInput => {
  if (scope.kind === "global") return {};
  if (scope.kind === "none") return { organisationId: "__none__" };
  if (scope.kind === "site") {
    return { siteId: { in: scope.siteIds } };
  }
  return { organisationId: { in: scope.organisationIds } };
};

const loadScope = async (actor: AlarmActor): Promise<AccessScope> =>
  resolveAccessScope(actor.id, actor.role as Role);

export const alarmEventScopeWhere = tenantWhereFromScope;

export const listAlarmRules = async (actor: AlarmActor) => {
  const scope = await loadScope(actor);
  return prisma.alarmRule.findMany({
    where: ruleWhereFromScope(scope),
    orderBy: [{ updatedAt: "desc" }],
    take: 200
  });
};

export const createAlarmRule = async (
  input: {
    organisationId: string;
    siteId?: string;
    plantId?: string;
    assetId?: string;
    name: string;
    description?: string;
    metricKey: string;
    comparator?: "gt" | "gte" | "lt" | "lte" | "eq" | "neq";
    threshold: number;
    severity?: "info" | "warning" | "major" | "critical";
    enabled?: boolean;
    cooldownSeconds?: number;
    notificationDestinations?: Prisma.InputJsonValue;
    metadata?: Prisma.InputJsonValue;
  },
  actor: AlarmActor
) => {
  const scope = await loadScope(actor);
  assertOrganisationAccess(scope, input.organisationId);
  if (input.siteId) {
    await assertSiteAccess(scope, input.siteId);
  } else if (scope.kind === "site") {
    throw new AppError("Organisation-wide alarm rules require organisation access.", 403);
  }

  const data: Prisma.AlarmRuleUncheckedCreateInput = {
    organisationId: input.organisationId,
    name: input.name,
    metricKey: input.metricKey,
    threshold: input.threshold,
    comparator: input.comparator ?? "gt",
    severity: input.severity ?? "warning",
    enabled: input.enabled ?? true,
    cooldownSeconds: input.cooldownSeconds ?? 300
  };
  if (input.siteId) data.siteId = input.siteId;
  if (input.plantId) data.plantId = input.plantId;
  if (input.assetId) data.assetId = input.assetId;
  if (input.description) data.description = input.description;
  if (input.notificationDestinations !== undefined) {
    data.notificationDestinations = input.notificationDestinations;
  }
  if (input.metadata !== undefined) data.metadata = input.metadata;

  const rule = await prisma.alarmRule.create({ data });
  await recordAuditLog({
    action: "alarm_rule.create",
    entityType: "AlarmRule",
    entityId: rule.id,
    message: `Created alarm rule ${rule.name}`,
    userId: actor.id,
    organisationId: rule.organisationId,
    siteId: rule.siteId ?? undefined
  });
  return rule;
};

export const listAlarmEvents = async (
  actor: AlarmActor,
  filters?: { status?: string; siteId?: string }
) => {
  const scope = await loadScope(actor);
  if (filters?.siteId) {
    await assertSiteAccess(scope, filters.siteId);
  }

  const where: Prisma.AlarmEventWhereInput = {
    ...tenantWhereFromScope(scope)
  };
  if (filters?.status) {
    where.status = filters.status as "active" | "acknowledged" | "cleared" | "suppressed";
  }
  if (filters?.siteId) {
    where.siteId = filters.siteId;
  }

  return prisma.alarmEvent.findMany({
    where,
    orderBy: [{ startedAt: "desc" }],
    take: 200,
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      acknowledgements: {
        orderBy: { acknowledgedAt: "desc" },
        take: 5,
        select: { id: true, userId: true, note: true, acknowledgedAt: true }
      }
    }
  });
};

export const raiseAlarmEvent = async (
  input: {
    organisationId: string;
    siteId: string;
    plantId?: string;
    assetId?: string;
    ruleId?: string;
    severity?: "info" | "warning" | "major" | "critical";
    title: string;
    message: string;
    metricKey?: string;
    metricValue?: number;
    threshold?: number;
    metadata?: Prisma.InputJsonValue;
  },
  actor: AlarmActor
) => {
  const scope = await loadScope(actor);
  assertOrganisationAccess(scope, input.organisationId);
  await assertSiteAccess(scope, input.siteId);

  const data: Prisma.AlarmEventUncheckedCreateInput = {
    organisationId: input.organisationId,
    siteId: input.siteId,
    title: input.title,
    message: input.message,
    severity: input.severity ?? "warning",
    status: "active"
  };
  if (input.plantId) data.plantId = input.plantId;
  if (input.assetId) data.assetId = input.assetId;
  if (input.ruleId) data.ruleId = input.ruleId;
  if (input.metricKey) data.metricKey = input.metricKey;
  if (typeof input.metricValue === "number") data.metricValue = input.metricValue;
  if (typeof input.threshold === "number") data.threshold = input.threshold;
  if (input.metadata !== undefined) data.metadata = input.metadata;

  const event = await prisma.alarmEvent.create({ data });
  await recordAuditLog({
    action: "alarm_event.raise",
    entityType: "AlarmEvent",
    entityId: event.id,
    message: event.title,
    userId: actor.id,
    organisationId: event.organisationId,
    siteId: event.siteId
  });
  return event;
};

export const acknowledgeAlarmEvent = async (
  alarmEventId: string,
  actor: AlarmActor,
  note?: string
) => {
  const scope = await loadScope(actor);
  const event = await prisma.alarmEvent.findUnique({ where: { id: alarmEventId } });
  if (!event) throw new AppError("Alarm event not found.", 404);
  assertOrganisationAccess(scope, event.organisationId);
  await assertSiteAccess(scope, event.siteId);

  const ackData: Prisma.AlarmAcknowledgementUncheckedCreateInput = {
    alarmEventId,
    userId: actor.id
  };
  if (note) ackData.note = note;

  const [acknowledgement] = await prisma.$transaction([
    prisma.alarmAcknowledgement.create({ data: ackData }),
    prisma.alarmEvent.update({
      where: { id: alarmEventId },
      data: { status: "acknowledged" }
    })
  ]);

  await recordAuditLog({
    action: "alarm_event.acknowledge",
    entityType: "AlarmEvent",
    entityId: alarmEventId,
    message: note ?? "Acknowledged",
    userId: actor.id,
    organisationId: event.organisationId,
    siteId: event.siteId
  });

  return acknowledgement;
};

export const clearAlarmEvent = async (
  alarmEventId: string,
  actor: AlarmActor,
  resolutionNote?: string
) => {
  const scope = await loadScope(actor);
  const event = await prisma.alarmEvent.findUnique({ where: { id: alarmEventId } });
  if (!event) throw new AppError("Alarm event not found.", 404);
  assertOrganisationAccess(scope, event.organisationId);
  await assertSiteAccess(scope, event.siteId);

  const updated = await prisma.alarmEvent.update({
    where: { id: alarmEventId },
    data: {
      status: "cleared",
      clearedAt: new Date(),
      resolutionNotes: resolutionNote ?? event.resolutionNotes,
      metadata: {
        ...((event.metadata as Record<string, unknown> | null) ?? {}),
        resolutionNote: resolutionNote ?? null,
        clearedByUserId: actor.id
      }
    }
  });

  await recordAuditLog({
    action: "alarm_event.clear",
    entityType: "AlarmEvent",
    entityId: alarmEventId,
    message: resolutionNote ?? "Cleared",
    userId: actor.id,
    organisationId: event.organisationId,
    siteId: event.siteId
  });

  return updated;
};

export const assignAlarmEvent = async (
  alarmEventId: string,
  assigneeUserId: string,
  actor: AlarmActor,
  note?: string
) => {
  const scope = await loadScope(actor);
  const event = await prisma.alarmEvent.findUnique({ where: { id: alarmEventId } });
  if (!event) throw new AppError("Alarm event not found.", 404);
  assertOrganisationAccess(scope, event.organisationId);
  await assertSiteAccess(scope, event.siteId);

  const assignee = await prisma.user.findUnique({ where: { id: assigneeUserId } });
  if (!assignee) throw new AppError("Assignee user not found.", 404);

  const updated = await prisma.alarmEvent.update({
    where: { id: alarmEventId },
    data: {
      assigneeUserId,
      metadata: {
        ...((event.metadata as Record<string, unknown> | null) ?? {}),
        assignmentNote: note ?? null,
        assignedByUserId: actor.id,
        assignedAt: new Date().toISOString()
      }
    },
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      acknowledgements: { orderBy: { acknowledgedAt: "desc" }, take: 5 }
    }
  });

  await recordAuditLog({
    action: "alarm_event.assign",
    entityType: "AlarmEvent",
    entityId: alarmEventId,
    message: note ?? `Assigned to ${assignee.name}`,
    userId: actor.id,
    organisationId: event.organisationId,
    siteId: event.siteId
  });

  return updated;
};

export const escalateAlarmEvent = async (alarmEventId: string, actor: AlarmActor, note?: string) => {
  const scope = await loadScope(actor);
  const event = await prisma.alarmEvent.findUnique({ where: { id: alarmEventId } });
  if (!event) throw new AppError("Alarm event not found.", 404);
  assertOrganisationAccess(scope, event.organisationId);
  await assertSiteAccess(scope, event.siteId);

  const nextLevel = event.escalationLevel + 1;
  const nextSeverity =
    event.severity === "info"
      ? "warning"
      : event.severity === "warning"
        ? "major"
        : event.severity === "major"
          ? "critical"
          : "critical";

  const updated = await prisma.alarmEvent.update({
    where: { id: alarmEventId },
    data: {
      escalationLevel: nextLevel,
      severity: nextSeverity,
      metadata: {
        ...((event.metadata as Record<string, unknown> | null) ?? {}),
        lastEscalationNote: note ?? null,
        lastEscalatedBy: actor.id,
        lastEscalatedAt: new Date().toISOString()
      }
    },
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      acknowledgements: { orderBy: { acknowledgedAt: "desc" }, take: 5 }
    }
  });

  await recordAuditLog({
    action: "alarm_event.escalate",
    entityType: "AlarmEvent",
    entityId: alarmEventId,
    message: note ?? `Escalated to level ${nextLevel}`,
    userId: actor.id,
    organisationId: event.organisationId,
    siteId: event.siteId
  });

  return updated;
};

export const reopenAlarmEvent = async (alarmEventId: string, actor: AlarmActor, note?: string) => {
  const scope = await loadScope(actor);
  const event = await prisma.alarmEvent.findUnique({ where: { id: alarmEventId } });
  if (!event) throw new AppError("Alarm event not found.", 404);
  assertOrganisationAccess(scope, event.organisationId);
  await assertSiteAccess(scope, event.siteId);

  if (event.status !== "cleared" && event.status !== "suppressed") {
    throw new AppError("Only cleared or suppressed alarms can be reopened.", 400);
  }

  const updated = await prisma.alarmEvent.update({
    where: { id: alarmEventId },
    data: {
      status: "active",
      clearedAt: null,
      reopenedAt: new Date(),
      resolutionNotes: null,
      metadata: {
        ...((event.metadata as Record<string, unknown> | null) ?? {}),
        reopenNote: note ?? null,
        reopenedByUserId: actor.id
      }
    },
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      acknowledgements: { orderBy: { acknowledgedAt: "desc" }, take: 5 }
    }
  });

  await recordAuditLog({
    action: "alarm_event.reopen",
    entityType: "AlarmEvent",
    entityId: alarmEventId,
    message: note ?? "Reopened incorrectly closed alarm",
    userId: actor.id,
    organisationId: event.organisationId,
    siteId: event.siteId
  });

  return updated;
};

export const updateAlarmRule = async (
  ruleId: string,
  input: {
    name?: string;
    description?: string | null;
    metricKey?: string;
    comparator?: "gt" | "gte" | "lt" | "lte" | "eq" | "neq";
    threshold?: number;
    severity?: "info" | "warning" | "major" | "critical";
    enabled?: boolean;
    cooldownSeconds?: number;
    notificationDestinations?: Prisma.InputJsonValue;
    metadata?: Prisma.InputJsonValue;
  },
  actor: AlarmActor
) => {
  const scope = await loadScope(actor);
  const existing = await prisma.alarmRule.findUnique({ where: { id: ruleId } });
  if (!existing) throw new AppError("Alarm rule not found.", 404);
  assertOrganisationAccess(scope, existing.organisationId);
  if (existing.siteId) {
    await assertSiteAccess(scope, existing.siteId);
  } else if (scope.kind === "site") {
    throw new AppError("Organisation-wide alarm rules require organisation access.", 403);
  }

  const data: Prisma.AlarmRuleUncheckedUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description;
  if (input.metricKey !== undefined) data.metricKey = input.metricKey;
  if (input.comparator !== undefined) data.comparator = input.comparator;
  if (input.threshold !== undefined) data.threshold = input.threshold;
  if (input.severity !== undefined) data.severity = input.severity;
  if (input.enabled !== undefined) data.enabled = input.enabled;
  if (input.cooldownSeconds !== undefined) data.cooldownSeconds = input.cooldownSeconds;
  if (input.notificationDestinations !== undefined) {
    data.notificationDestinations = input.notificationDestinations;
  }
  if (input.metadata !== undefined) data.metadata = input.metadata;

  const rule = await prisma.alarmRule.update({ where: { id: ruleId }, data });
  await recordAuditLog({
    action: "alarm_rule.update",
    entityType: "AlarmRule",
    entityId: rule.id,
    message: `Updated alarm rule ${rule.name}`,
    userId: actor.id,
    organisationId: rule.organisationId,
    siteId: rule.siteId ?? undefined
  });
  return rule;
};

export const listIncidents = async (actor: AlarmActor) => {
  const scope = await loadScope(actor);
  return prisma.incident.findMany({
    where: incidentWhereFromScope(scope),
    orderBy: [{ openedAt: "desc" }],
    take: 100,
    include: {
      timeline: { orderBy: { createdAt: "asc" }, take: 20 },
      _count: { select: { alarmEvents: true } }
    }
  });
};

export const createIncident = async (
  input: {
    organisationId: string;
    siteId: string;
    plantId?: string;
    title: string;
    summary?: string;
    severity?: "info" | "warning" | "major" | "critical";
    alarmEventIds?: string[];
  },
  actor: AlarmActor
) => {
  const scope = await loadScope(actor);
  assertOrganisationAccess(scope, input.organisationId);
  await assertSiteAccess(scope, input.siteId);

  const incident = await prisma.$transaction(async (tx) => {
    const createData: Prisma.IncidentUncheckedCreateInput = {
      organisationId: input.organisationId,
      siteId: input.siteId,
      title: input.title,
      severity: input.severity ?? "major",
      openedById: actor.id,
      timeline: {
        create: {
          actorUserId: actor.id,
          eventType: "opened",
          message: `Incident opened: ${input.title}`
        }
      }
    };
    if (input.plantId) createData.plantId = input.plantId;
    if (input.summary) createData.summary = input.summary;

    const created = await tx.incident.create({
      data: createData,
      include: { timeline: true }
    });

    if (input.alarmEventIds?.length) {
      await tx.alarmEvent.updateMany({
        where: {
          id: { in: input.alarmEventIds },
          organisationId: input.organisationId,
          siteId: input.siteId
        },
        data: { incidentId: created.id }
      });
    }

    return created;
  });

  await recordAuditLog({
    action: "incident.create",
    entityType: "Incident",
    entityId: incident.id,
    message: incident.title,
    userId: actor.id,
    organisationId: incident.organisationId,
    siteId: incident.siteId
  });

  return incident;
};

export const appendIncidentTimeline = async (
  incidentId: string,
  actor: AlarmActor,
  input: { eventType: string; message: string; metadata?: Prisma.InputJsonValue }
) => {
  const scope = await loadScope(actor);
  const incident = await prisma.incident.findUnique({ where: { id: incidentId } });
  if (!incident) throw new AppError("Incident not found.", 404);
  assertOrganisationAccess(scope, incident.organisationId);
  await assertSiteAccess(scope, incident.siteId);

  const data: Prisma.IncidentTimelineUncheckedCreateInput = {
    incidentId,
    actorUserId: actor.id,
    eventType: input.eventType,
    message: input.message
  };
  if (input.metadata !== undefined) data.metadata = input.metadata;

  return prisma.incidentTimeline.create({ data });
};
