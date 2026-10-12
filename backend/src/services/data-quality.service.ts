import { Prisma } from "@prisma/client";

import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/AppError.js";
import { recordAuditLog } from "./audit-log.service.js";

export type DataQualityActor = { id: string; name: string; role: string };

export const DATA_QUALITY_TYPES = [
  "missing_readings",
  "stale_data",
  "timestamp_error",
  "invalid_units",
  "out_of_range",
  "duplicate_readings",
  "sensor_drift",
  "communication_gap"
] as const;

export type DataQualityType = (typeof DATA_QUALITY_TYPES)[number];

type HistoryEntry = { at: string; actor: string; note: string; status: string };

const toDto = (row: {
  id: string;
  organisationId: string | null;
  siteId: string | null;
  plantId: string | null;
  exceptionType: string;
  title: string;
  detail: string;
  provenance: string;
  quality: string;
  status: string;
  resolutionNotes: string;
  resolvedById: string | null;
  resolvedAt: Date | null;
  approvedByName: string | null;
  approvedAt: Date | null;
  history: Prisma.JsonValue;
  releaseGitSha: string | null;
  createdAt: Date;
  updatedAt: Date;
  resolvedBy?: { name: string } | null;
}) => ({
  id: row.id,
  organisationId: row.organisationId,
  siteId: row.siteId,
  plantId: row.plantId,
  exceptionType: row.exceptionType,
  title: row.title,
  detail: row.detail,
  provenance: row.provenance,
  quality: row.quality,
  status: row.status,
  resolutionNotes: row.resolutionNotes,
  resolvedById: row.resolvedById,
  resolvedByName: row.resolvedBy?.name ?? null,
  resolvedAt: row.resolvedAt?.toISOString() ?? null,
  approvedByName: row.approvedByName,
  approvedAt: row.approvedAt?.toISOString() ?? null,
  history: (Array.isArray(row.history) ? row.history : []) as HistoryEntry[],
  releaseGitSha: row.releaseGitSha,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString()
});

export const listDataQualityExceptions = async (filters?: { status?: string; exceptionType?: string }) => {
  const where: Prisma.DataQualityExceptionWhereInput = {};
  if (filters?.status) where.status = filters.status;
  if (filters?.exceptionType) where.exceptionType = filters.exceptionType;

  const rows = await prisma.dataQualityException.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }],
    take: 200,
    include: { resolvedBy: { select: { name: true } } }
  });
  return rows.map(toDto);
};

export const createDataQualityException = async (
  input: {
    organisationId?: string;
    siteId?: string;
    plantId?: string;
    exceptionType: string;
    title: string;
    detail?: string;
    provenance?: string;
    quality?: string;
  },
  actor: DataQualityActor
) => {
  if (!DATA_QUALITY_TYPES.includes(input.exceptionType as DataQualityType)) {
    throw new AppError(`Invalid exceptionType. Allowed: ${DATA_QUALITY_TYPES.join(", ")}`, 400);
  }

  const history: HistoryEntry[] = [
    {
      at: new Date().toISOString(),
      actor: actor.name,
      note: "Exception opened",
      status: "open"
    }
  ];

  const data: Prisma.DataQualityExceptionUncheckedCreateInput = {
    exceptionType: input.exceptionType,
    title: input.title,
    detail: input.detail ?? "",
    provenance: input.provenance ?? "measured",
    quality: input.quality ?? "uncertain",
    status: "open",
    history,
    releaseGitSha: env.RELEASE_GIT_SHA?.trim() || null
  };
  if (input.organisationId) data.organisationId = input.organisationId;
  if (input.siteId) data.siteId = input.siteId;
  if (input.plantId) data.plantId = input.plantId;

  const row = await prisma.dataQualityException.create({
    data,
    include: { resolvedBy: { select: { name: true } } }
  });

  await recordAuditLog({
    action: "data_quality.create",
    entityType: "DataQualityException",
    entityId: row.id,
    message: row.title,
    userId: actor.id,
    organisationId: input.organisationId,
    siteId: input.siteId
  });

  return toDto(row);
};

export const updateDataQualityException = async (
  id: string,
  patch: {
    status?: string;
    resolutionNotes?: string;
    approvedByName?: string;
    detail?: string;
  },
  actor: DataQualityActor
) => {
  const current = await prisma.dataQualityException.findUnique({ where: { id } });
  if (!current) throw new AppError("Data quality exception not found.", 404);

  const history = (Array.isArray(current.history) ? current.history : []) as HistoryEntry[];
  const nextStatus = patch.status ?? current.status;
  history.push({
    at: new Date().toISOString(),
    actor: actor.name,
    note: patch.resolutionNotes ?? `Status → ${nextStatus}`,
    status: nextStatus
  });

  const data: Prisma.DataQualityExceptionUncheckedUpdateInput = {
    history
  };
  if (patch.status !== undefined) data.status = patch.status;
  if (patch.resolutionNotes !== undefined) data.resolutionNotes = patch.resolutionNotes;
  if (patch.detail !== undefined) data.detail = patch.detail;
  if (patch.status === "resolved" || patch.status === "approved") {
    data.resolvedById = actor.id;
    data.resolvedAt = new Date();
  }
  if (patch.approvedByName !== undefined || patch.status === "approved") {
    data.approvedByName = patch.approvedByName ?? actor.name;
    data.approvedAt = new Date();
  }

  const row = await prisma.dataQualityException.update({
    where: { id },
    data,
    include: { resolvedBy: { select: { name: true } } }
  });

  await recordAuditLog({
    action: "data_quality.update",
    entityType: "DataQualityException",
    entityId: row.id,
    message: `${current.status} → ${row.status}`,
    userId: actor.id,
    organisationId: row.organisationId ?? undefined,
    siteId: row.siteId ?? undefined
  });

  return toDto(row);
};

/** Seed catalogue rows when empty so the UI is immediately usable. */
export const ensureDataQualityCatalogue = async (actor: DataQualityActor) => {
  const count = await prisma.dataQualityException.count();
  if (count > 0) return listDataQualityExceptions();

  const seeds: Array<{ exceptionType: DataQualityType; title: string; quality: string }> = [
    { exceptionType: "stale_data", title: "Stale inverter telemetry > 15 min", quality: "stale" },
    { exceptionType: "missing_readings", title: "Missing export_kw intervals", quality: "bad" },
    { exceptionType: "timestamp_error", title: "Device clock drift > 5 minutes", quality: "uncertain" },
    { exceptionType: "invalid_units", title: "Power reported in W instead of kW", quality: "bad" },
    { exceptionType: "out_of_range", title: "Irradiance sample above physical max", quality: "bad" },
    { exceptionType: "duplicate_readings", title: "Duplicate signed ingest packets", quality: "uncertain" },
    { exceptionType: "sensor_drift", title: "Pyranometer drift vs clear-sky baseline", quality: "uncertain" },
    { exceptionType: "communication_gap", title: "Edge node offline communication gap", quality: "bad" }
  ];

  for (const seed of seeds) {
    await createDataQualityException(
      {
        exceptionType: seed.exceptionType,
        title: seed.title,
        quality: seed.quality,
        provenance: seed.exceptionType === "sensor_drift" ? "estimated" : "measured",
        detail: "Opened by catalogue bootstrap for pilot exception management."
      },
      actor
    );
  }

  return listDataQualityExceptions();
};
