import { Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/AppError.js";
import { recordAuditLog } from "./audit-log.service.js";

export type RecoveryCaseActor = { id: string; name: string; role: string };

type HistoryEntry = { at: string; actor: string; note: string; status: string };

const toDto = (row: {
  id: string;
  caseNumber: string;
  organisationId: string | null;
  siteId: string | null;
  title: string;
  plantLabel: string;
  ownerUserId: string | null;
  ownerName: string;
  engineeringReviewer: string | null;
  status: string;
  selectedOption: string | null;
  evidenceNotes: string;
  evidenceAttachments: Prisma.JsonValue;
  predictedSavingsZar: number | null;
  realisedSavingsZar: number | null;
  actualRecoveredEnergyKwh: number | null;
  realisationRevenueZar: number | null;
  implementationDate: Date | null;
  closedAt: Date | null;
  verificationNotes: string;
  history: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: row.id,
  caseNumber: row.caseNumber,
  organisationId: row.organisationId,
  siteId: row.siteId,
  title: row.title,
  plantLabel: row.plantLabel,
  ownerUserId: row.ownerUserId,
  owner: row.ownerName,
  engineeringReviewer: row.engineeringReviewer,
  status: row.status,
  selectedOption: row.selectedOption,
  evidenceNotes: row.evidenceNotes,
  evidenceAttachments: Array.isArray(row.evidenceAttachments)
    ? (row.evidenceAttachments as string[])
    : [],
  predictedSavingsZar: row.predictedSavingsZar,
  realisedSavingsZar: row.realisedSavingsZar,
  actualRecoveredEnergyKwh: row.actualRecoveredEnergyKwh,
  realisationRevenueZar: row.realisationRevenueZar,
  implementationDate: row.implementationDate?.toISOString().slice(0, 10) ?? null,
  closedAt: row.closedAt?.toISOString() ?? null,
  verificationNotes: row.verificationNotes,
  history: (Array.isArray(row.history) ? row.history : []) as HistoryEntry[],
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString()
});

export const listRecoveryCases = async (limit = 100) => {
  const rows = await prisma.recoveryCaseRecord.findMany({
    orderBy: [{ updatedAt: "desc" }],
    take: Math.min(limit, 200)
  });
  return rows.map(toDto);
};

export const createRecoveryCase = async (
  input: {
    title: string;
    plantLabel: string;
    predictedSavingsZar?: number | null;
    engineeringReviewer?: string | null;
    organisationId?: string;
    siteId?: string;
  },
  actor: RecoveryCaseActor
) => {
  const now = new Date();
  const seq = String(Date.now()).slice(-6);
  const history: HistoryEntry[] = [
    { at: now.toISOString(), actor: actor.name, note: "Case created", status: "draft" }
  ];

  const data: Prisma.RecoveryCaseRecordUncheckedCreateInput = {
    caseNumber: `RC-${now.getFullYear()}-${seq}`,
    title: input.title,
    plantLabel: input.plantLabel,
    ownerUserId: actor.id,
    ownerName: actor.name,
    engineeringReviewer: input.engineeringReviewer ?? null,
    status: "draft",
    predictedSavingsZar: input.predictedSavingsZar ?? null,
    evidenceAttachments: [],
    history
  };
  if (input.organisationId) data.organisationId = input.organisationId;
  if (input.siteId) data.siteId = input.siteId;

  const row = await prisma.recoveryCaseRecord.create({ data });

  await recordAuditLog({
    action: "recovery_case.create",
    entityType: "RecoveryCaseRecord",
    entityId: row.id,
    message: `Created ${row.caseNumber}`,
    userId: actor.id,
    organisationId: input.organisationId,
    siteId: input.siteId
  });

  return toDto(row);
};

export const updateRecoveryCase = async (
  id: string,
  patch: {
    status?: string;
    ownerName?: string;
    engineeringReviewer?: string | null;
    selectedOption?: string | null;
    evidenceNotes?: string;
    evidenceAttachments?: string[];
    predictedSavingsZar?: number | null;
    realisedSavingsZar?: number | null;
    actualRecoveredEnergyKwh?: number | null;
    realisationRevenueZar?: number | null;
    implementationDate?: string | null;
    closedAt?: string | null;
    verificationNotes?: string;
  },
  actor: RecoveryCaseActor,
  note: string
) => {
  const current = await prisma.recoveryCaseRecord.findUnique({ where: { id } });
  if (!current) throw new AppError("Recovery case not found.", 404);

  const history = (Array.isArray(current.history) ? current.history : []) as HistoryEntry[];
  const nextStatus = patch.status ?? current.status;
  history.unshift({
    at: new Date().toISOString(),
    actor: actor.name,
    note,
    status: nextStatus
  });

  const data: Prisma.RecoveryCaseRecordUncheckedUpdateInput = {
    history,
    updatedAt: new Date()
  };
  if (patch.status !== undefined) data.status = patch.status;
  if (patch.ownerName !== undefined) {
    data.ownerName = patch.ownerName;
    data.ownerUserId = actor.id;
  }
  if (patch.engineeringReviewer !== undefined) data.engineeringReviewer = patch.engineeringReviewer;
  if (patch.selectedOption !== undefined) data.selectedOption = patch.selectedOption;
  if (patch.evidenceNotes !== undefined) data.evidenceNotes = patch.evidenceNotes;
  if (patch.evidenceAttachments !== undefined) {
    data.evidenceAttachments = patch.evidenceAttachments;
  }
  if (patch.predictedSavingsZar !== undefined) data.predictedSavingsZar = patch.predictedSavingsZar;
  if (patch.realisedSavingsZar !== undefined) data.realisedSavingsZar = patch.realisedSavingsZar;
  if (patch.actualRecoveredEnergyKwh !== undefined) {
    data.actualRecoveredEnergyKwh = patch.actualRecoveredEnergyKwh;
  }
  if (patch.realisationRevenueZar !== undefined) {
    data.realisationRevenueZar = patch.realisationRevenueZar;
  }
  if (patch.implementationDate !== undefined) {
    data.implementationDate = patch.implementationDate ? new Date(patch.implementationDate) : null;
  }
  if (patch.closedAt !== undefined) {
    data.closedAt = patch.closedAt ? new Date(patch.closedAt) : null;
  }
  if (patch.verificationNotes !== undefined) data.verificationNotes = patch.verificationNotes;

  const row = await prisma.recoveryCaseRecord.update({ where: { id }, data });

  await recordAuditLog({
    action: "recovery_case.update",
    entityType: "RecoveryCaseRecord",
    entityId: row.id,
    message: note,
    userId: actor.id,
    organisationId: row.organisationId ?? undefined,
    siteId: row.siteId ?? undefined,
    metadata: { previousStatus: current.status, newStatus: row.status }
  });

  return toDto(row);
};
