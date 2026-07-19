import {
  DataQuality,
  DataSourceType,
  GridConstraintType,
  MeasurementUnit,
  Prisma,
  type GridConstraint
} from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/AppError.js";
import { recordAuditLog } from "./audit-log.service.js";
import type { AccessActor } from "./access-scope.service.js";
import { getOptionalSiteAccessScope } from "./access-scope.service.js";

const assertSiteAccess = async (siteId: string, actor?: AccessActor) => {
  const scope = await getOptionalSiteAccessScope(actor);
  if (scope.kind === "site" && scope.siteId !== siteId) {
    throw new AppError("Cross-tenant site access denied.", 403);
  }
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) throw new AppError("Site not found.", 404);
  return site;
};

export const listGridConstraints = async (
  filters: {
    siteId?: string;
    plantId?: string;
    constraintType?: GridConstraintType;
    limit?: number;
  },
  actor?: AccessActor
) => {
  const scope = await getOptionalSiteAccessScope(actor);
  const where: Prisma.GridConstraintWhereInput = {};

  if (scope.kind === "site") {
    where.siteId = scope.siteId;
  } else if (filters.siteId) {
    where.siteId = filters.siteId;
  }

  if (filters.plantId) where.plantId = filters.plantId;
  if (filters.constraintType) where.constraintType = filters.constraintType;

  return prisma.gridConstraint.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }],
    take: Math.min(filters.limit ?? 100, 500),
    include: {
      site: { select: { id: true, name: true, code: true } },
      plant: { select: { id: true, name: true, code: true } }
    }
  });
};

export const createGridConstraint = async (
  input: {
    organisationId: string;
    siteId: string;
    plantId?: string;
    constraintType: GridConstraintType;
    name: string;
    limitValue: number;
    unit: MeasurementUnit;
    validFrom?: string;
    validTo?: string;
    sourceType?: DataSourceType;
    quality?: DataQuality;
    provenance?: unknown;
    notes?: string;
  },
  actorId?: string,
  actor?: AccessActor
): Promise<GridConstraint> => {
  const site = await assertSiteAccess(input.siteId, actor);

  if (input.plantId) {
    const plant = await prisma.plant.findUnique({ where: { id: input.plantId } });
    if (!plant || plant.siteId !== site.id) {
      throw new AppError("Plant must belong to the same site.", 400);
    }
  }

  const organisationId = site.organisationId ?? input.organisationId;
  if (!organisationId) {
    throw new AppError("Site must be linked to an organisation before adding constraints.", 400);
  }

  const createData: Prisma.GridConstraintUncheckedCreateInput = {
    organisationId,
    siteId: site.id,
    plantId: input.plantId ?? null,
    constraintType: input.constraintType,
    name: input.name,
    limitValue: input.limitValue,
    unit: input.unit,
    validFrom: input.validFrom ? new Date(input.validFrom) : null,
    validTo: input.validTo ? new Date(input.validTo) : null,
    sourceType: input.sourceType ?? DataSourceType.operator_entered,
    quality: input.quality ?? DataQuality.unverified,
    notes: input.notes ?? null
  };
  if (input.provenance !== undefined) {
    createData.provenance = input.provenance as Prisma.InputJsonValue;
  }
  const created = await prisma.gridConstraint.create({ data: createData });

  await recordAuditLog({
    action: "grid-constraint.create",
    entityType: "GridConstraint",
    entityId: created.id,
    message: `Created grid constraint ${created.name}`,
    userId: actorId,
    organisationId: created.organisationId,
    siteId: created.siteId
  });

  return created;
};

export const updateGridConstraint = async (
  constraintId: string,
  input: {
    name?: string;
    limitValue?: number;
    unit?: MeasurementUnit;
    validFrom?: string | null;
    validTo?: string | null;
    sourceType?: DataSourceType;
    quality?: DataQuality;
    provenance?: unknown;
    notes?: string | null;
  },
  actorId?: string,
  actor?: AccessActor
) => {
  const scope = await getOptionalSiteAccessScope(actor);
  const existing = await prisma.gridConstraint.findUnique({ where: { id: constraintId } });
  if (!existing) throw new AppError("Grid constraint not found.", 404);
  if (scope.kind === "site" && existing.siteId !== scope.siteId) {
    throw new AppError("Cross-tenant constraint access denied.", 403);
  }

  const data: Prisma.GridConstraintUpdateInput = {};
  if (typeof input.name === "string") data.name = input.name;
  if (typeof input.limitValue === "number") data.limitValue = input.limitValue;
  if (input.unit) data.unit = input.unit;
  if (input.validFrom === null) data.validFrom = null;
  else if (typeof input.validFrom === "string") data.validFrom = new Date(input.validFrom);
  if (input.validTo === null) data.validTo = null;
  else if (typeof input.validTo === "string") data.validTo = new Date(input.validTo);
  if (input.sourceType) data.sourceType = input.sourceType;
  if (input.quality) data.quality = input.quality;
  if (input.provenance !== undefined) data.provenance = input.provenance as Prisma.InputJsonValue;
  if (input.notes === null) data.notes = null;
  else if (typeof input.notes === "string") data.notes = input.notes;

  const updated = await prisma.gridConstraint.update({
    where: { id: constraintId },
    data
  });

  await recordAuditLog({
    action: "grid-constraint.update",
    entityType: "GridConstraint",
    entityId: updated.id,
    message: `Updated grid constraint ${updated.name}`,
    userId: actorId,
    organisationId: updated.organisationId,
    siteId: updated.siteId
  });

  return updated;
};

export const deleteGridConstraint = async (
  constraintId: string,
  actorId?: string,
  actor?: AccessActor
) => {
  const scope = await getOptionalSiteAccessScope(actor);
  const existing = await prisma.gridConstraint.findUnique({ where: { id: constraintId } });
  if (!existing) throw new AppError("Grid constraint not found.", 404);
  if (scope.kind === "site" && existing.siteId !== scope.siteId) {
    throw new AppError("Cross-tenant constraint access denied.", 403);
  }

  await prisma.gridConstraint.delete({ where: { id: constraintId } });

  await recordAuditLog({
    action: "grid-constraint.delete",
    entityType: "GridConstraint",
    entityId: constraintId,
    message: `Deleted grid constraint ${existing.name}`,
    userId: actorId,
    organisationId: existing.organisationId,
    siteId: existing.siteId
  });

  return { id: constraintId };
};

/** True when the scoped tenant has no measured/imported constraints — UI should keep SimulationBanner. */
export const hasRealGridConstraints = async (actor?: AccessActor): Promise<boolean> => {
  const constraints = await listGridConstraints({ limit: 50 }, actor);
  return constraints.some(
    (row) =>
      row.sourceType === DataSourceType.measured ||
      row.sourceType === DataSourceType.imported ||
      row.sourceType === DataSourceType.operator_entered
  );
};
