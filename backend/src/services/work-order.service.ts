import { Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/AppError.js";
import { recordAuditLog } from "./audit-log.service.js";

export type WorkOrderActor = { id: string; name: string; role: string };

const toDto = (row: {
  id: string;
  organisationId: string | null;
  siteId: string | null;
  title: string;
  description: string;
  status: string;
  priority: string;
  assigneeUserId: string | null;
  createdById: string | null;
  dueAt: Date | null;
  closedAt: Date | null;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  notes: string;
  completionNotes: string;
  evidence: Prisma.JsonValue;
  approvalStatus: string;
  escalatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  assignee?: { id: string; name: string; email: string } | null;
  createdBy?: { id: string; name: string; email: string } | null;
}) => ({
  id: row.id,
  organisationId: row.organisationId,
  siteId: row.siteId,
  title: row.title,
  description: row.description,
  status: row.status,
  priority: row.priority,
  assigneeUserId: row.assigneeUserId,
  assigneeName: row.assignee?.name ?? null,
  createdById: row.createdById,
  createdByName: row.createdBy?.name ?? null,
  dueAt: row.dueAt?.toISOString() ?? null,
  closedAt: row.closedAt?.toISOString() ?? null,
  escalatedAt: row.escalatedAt?.toISOString() ?? null,
  relatedEntityType: row.relatedEntityType,
  relatedEntityId: row.relatedEntityId,
  notes: row.notes,
  completionNotes: row.completionNotes,
  evidence: Array.isArray(row.evidence) ? row.evidence : [],
  approvalStatus: row.approvalStatus,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString()
});

export const listWorkOrders = async (limit = 100) => {
  const rows = await prisma.workOrder.findMany({
    orderBy: [{ updatedAt: "desc" }],
    take: Math.min(limit, 200),
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true, email: true } }
    }
  });
  return rows.map(toDto);
};

export const createWorkOrder = async (
  input: {
    title: string;
    description?: string;
    priority?: string;
    assigneeUserId?: string;
    dueAt?: string;
    organisationId?: string;
    siteId?: string;
    relatedEntityType?: string;
    relatedEntityId?: string;
    notes?: string;
    evidence?: Prisma.InputJsonValue;
  },
  actor: WorkOrderActor
) => {
  const data: Prisma.WorkOrderUncheckedCreateInput = {
    title: input.title,
    description: input.description ?? "",
    priority: input.priority ?? "normal",
    status: input.assigneeUserId ? "assigned" : "open",
    createdById: actor.id,
    assigneeUserId: input.assigneeUserId ?? actor.id,
    notes: input.notes ?? "",
    evidence: input.evidence ?? []
  };
  if (input.organisationId) data.organisationId = input.organisationId;
  if (input.siteId) data.siteId = input.siteId;
  if (input.dueAt) data.dueAt = new Date(input.dueAt);
  if (input.relatedEntityType) data.relatedEntityType = input.relatedEntityType;
  if (input.relatedEntityId) data.relatedEntityId = input.relatedEntityId;

  const row = await prisma.workOrder.create({
    data,
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true, email: true } }
    }
  });

  await recordAuditLog({
    action: "work_order.create",
    entityType: "WorkOrder",
    entityId: row.id,
    message: `Created work order: ${row.title}`,
    userId: actor.id,
    organisationId: input.organisationId,
    siteId: input.siteId
  });

  return toDto(row);
};

export const updateWorkOrder = async (
  id: string,
  patch: {
    status?: string;
    priority?: string;
    assigneeUserId?: string | null;
    notes?: string;
    description?: string;
    dueAt?: string | null;
    completionNotes?: string;
    evidence?: Prisma.InputJsonValue;
    approvalStatus?: string;
    escalate?: boolean;
  },
  actor: WorkOrderActor
) => {
  const current = await prisma.workOrder.findUnique({ where: { id } });
  if (!current) throw new AppError("Work order not found.", 404);

  const data: Prisma.WorkOrderUncheckedUpdateInput = {};
  if (patch.status !== undefined) {
    data.status = patch.status;
    if (patch.status === "closed" || patch.status === "completed") {
      data.closedAt = new Date();
    }
    if (patch.status === "completed") {
      data.approvalStatus = current.approvalStatus === "none" ? "pending" : current.approvalStatus;
    }
  }
  if (patch.priority !== undefined) data.priority = patch.priority;
  if (patch.assigneeUserId !== undefined) data.assigneeUserId = patch.assigneeUserId;
  if (patch.notes !== undefined) data.notes = patch.notes;
  if (patch.description !== undefined) data.description = patch.description;
  if (patch.dueAt !== undefined) data.dueAt = patch.dueAt ? new Date(patch.dueAt) : null;
  if (patch.completionNotes !== undefined) data.completionNotes = patch.completionNotes;
  if (patch.evidence !== undefined) data.evidence = patch.evidence;
  if (patch.approvalStatus !== undefined) data.approvalStatus = patch.approvalStatus;
  if (patch.escalate) {
    data.escalatedAt = new Date();
    data.priority = "urgent";
    if (current.status === "open" || current.status === "assigned") {
      data.status = "escalated";
    }
  }

  const row = await prisma.workOrder.update({
    where: { id },
    data,
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true, email: true } }
    }
  });

  await recordAuditLog({
    action: "work_order.update",
    entityType: "WorkOrder",
    entityId: row.id,
    message: `Updated work order (${current.status} → ${row.status})`,
    userId: actor.id,
    organisationId: row.organisationId ?? undefined,
    siteId: row.siteId ?? undefined
  });

  return toDto(row);
};
