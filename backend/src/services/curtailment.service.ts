import {
  CurtailmentCause,
  CurtailmentEventStatus,
  Prisma,
  type CurtailmentEvent
} from "@prisma/client";

import {
  detectCurtailmentEvents,
  type CurtailmentSample,
  DEFAULT_CURTAILMENT_CONFIG
} from "../domain/curtailment/engine.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/AppError.js";
import { recordAuditLog } from "./audit-log.service.js";
import type { AccessActor } from "./access-scope.service.js";
import { getOptionalSiteAccessScope } from "./access-scope.service.js";

const assertPlantAccess = async (plantId: string, actor?: AccessActor) => {
  const scope = await getOptionalSiteAccessScope(actor);
  const plant = await prisma.plant.findUnique({ where: { id: plantId } });
  if (!plant) throw new AppError("Plant not found.", 404);
  if (scope.kind === "site" && plant.siteId !== scope.siteId) {
    throw new AppError("Cross-tenant plant access denied.", 403);
  }
  return plant;
};

export const listCurtailmentEvents = async (
  filters: {
    plantId?: string;
    siteId?: string;
    status?: CurtailmentEventStatus;
    cause?: CurtailmentCause;
    limit?: number;
  },
  actor?: AccessActor
) => {
  const scope = await getOptionalSiteAccessScope(actor);
  const where: Prisma.CurtailmentEventWhereInput = {};

  if (scope.kind === "site") {
    where.siteId = scope.siteId;
  } else if (filters.siteId) {
    where.siteId = filters.siteId;
  }

  if (filters.plantId) where.plantId = filters.plantId;
  if (filters.status) where.status = filters.status;
  if (filters.cause) where.cause = filters.cause;

  return prisma.curtailmentEvent.findMany({
    where,
    orderBy: [{ startTime: "desc" }],
    take: Math.min(filters.limit ?? 100, 500),
    include: {
      plant: { select: { id: true, name: true, code: true, dataSourceType: true } },
      site: { select: { id: true, name: true, code: true } },
      corrections: {
        orderBy: { createdAt: "desc" },
        take: 5
      }
    }
  });
};

export const getCurtailmentEvent = async (eventId: string, actor?: AccessActor) => {
  const scope = await getOptionalSiteAccessScope(actor);
  const event = await prisma.curtailmentEvent.findUnique({
    where: { id: eventId },
    include: {
      plant: { select: { id: true, name: true, code: true, dataSourceType: true } },
      site: { select: { id: true, name: true, code: true } },
      corrections: { orderBy: { createdAt: "desc" } }
    }
  });
  if (!event) throw new AppError("Curtailment event not found.", 404);
  if (scope.kind === "site" && event.siteId !== scope.siteId) {
    throw new AppError("Cross-tenant curtailment access denied.", 403);
  }
  return event;
};

export const detectAndPersistCurtailmentEvents = async (
  input: {
    plantId: string;
    samples: CurtailmentSample[];
  },
  actorId?: string,
  actor?: AccessActor
): Promise<CurtailmentEvent[]> => {
  const plant = await assertPlantAccess(input.plantId, actor);
  const detected = detectCurtailmentEvents(input.samples, DEFAULT_CURTAILMENT_CONFIG);

  const created: CurtailmentEvent[] = [];
  for (const interval of detected) {
    const event = await prisma.curtailmentEvent.create({
      data: {
        organisationId: plant.organisationId,
        siteId: plant.siteId,
        plantId: plant.id,
        startTime: new Date(interval.startTime),
        endTime: new Date(interval.endTime),
        status: CurtailmentEventStatus.open,
        cause: interval.cause as CurtailmentCause,
        causeConfidence: interval.causeConfidence,
        availablePowerKw: interval.availablePowerKw,
        actualPowerKw: interval.actualPowerKw,
        curtailedPowerKw: interval.curtailedPowerKw,
        estimatedLostEnergyKwh: interval.estimatedLostEnergyKwh,
        recoverableEnergyKwh: interval.recoverableEnergyKwh,
        exportLimitKw: interval.exportLimitKw,
        ppcSetpointKw: interval.ppcSetpointKw,
        evidence: interval.evidence as Prisma.InputJsonValue,
        calculationVersion: interval.calculationVersion
      }
    });
    created.push(event);
  }

  if (created.length > 0) {
    await recordAuditLog({
      action: "curtailment.detect",
      entityType: "CurtailmentEvent",
      entityId: plant.id,
      message: `Detected ${created.length} curtailment event(s) for plant ${plant.code}`,
      userId: actorId,
      organisationId: plant.organisationId,
      siteId: plant.siteId,
      metadata: { eventIds: created.map((event) => event.id) }
    });
  }

  return created;
};

export const reviewCurtailmentEvent = async (
  eventId: string,
  input: {
    status?: CurtailmentEventStatus;
    operatorNotes?: string;
  },
  actorId?: string,
  actor?: AccessActor
) => {
  const existing = await getCurtailmentEvent(eventId, actor);
  const data: Prisma.CurtailmentEventUpdateInput = {
    reviewedAt: new Date()
  };
  if (actorId) data.reviewedBy = actorId;
  if (input.status) data.status = input.status;
  if (typeof input.operatorNotes === "string") data.operatorNotes = input.operatorNotes;

  const updated = await prisma.curtailmentEvent.update({
    where: { id: existing.id },
    data
  });

  await recordAuditLog({
    action: "curtailment.review",
    entityType: "CurtailmentEvent",
    entityId: updated.id,
    message: `Reviewed curtailment event ${updated.id}`,
    userId: actorId,
    organisationId: updated.organisationId,
    siteId: updated.siteId,
    metadata: { status: updated.status }
  });

  return updated;
};

export const addCurtailmentCorrection = async (
  eventId: string,
  input: {
    notes: string;
    correctedCause?: CurtailmentCause;
    correctedRecoverableEnergyKwh?: number;
  },
  actorId?: string,
  actor?: AccessActor
) => {
  const existing = await getCurtailmentEvent(eventId, actor);

  const correction = await prisma.curtailmentCorrection.create({
    data: {
      eventId: existing.id,
      notes: input.notes,
      correctedCause: input.correctedCause ?? null,
      correctedRecoverableEnergyKwh: input.correctedRecoverableEnergyKwh ?? null,
      createdById: actorId ?? null
    }
  });

  await recordAuditLog({
    action: "curtailment.correction",
    entityType: "CurtailmentCorrection",
    entityId: correction.id,
    message: `Added curtailment correction for event ${existing.id}`,
    userId: actorId,
    organisationId: existing.organisationId,
    siteId: existing.siteId
  });

  return correction;
};

export const getCurtailmentSummary = async (actor?: AccessActor) => {
  const events = await listCurtailmentEvents({ limit: 200 }, actor);
  const totalLostKwh = events.reduce((sum, event) => sum + event.estimatedLostEnergyKwh, 0);
  const recoverableKwh = events.reduce((sum, event) => sum + event.recoverableEnergyKwh, 0);
  const byCause = new Map<string, number>();
  for (const event of events) {
    byCause.set(event.cause, (byCause.get(event.cause) ?? 0) + event.estimatedLostEnergyKwh);
  }
  const causeRows = Array.from(byCause.entries())
    .map(([cause, energyKwh]) => ({ cause, energyKwh: Number(energyKwh.toFixed(3)) }))
    .sort((a, b) => b.energyKwh - a.energyKwh);

  return {
    eventCount: events.length,
    totalLostKwh: Number(totalLostKwh.toFixed(3)),
    recoverableKwh: Number(recoverableKwh.toFixed(3)),
    causeRows,
    events: events.slice(0, 50)
  };
};
