import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/AppError.js";

export const OPERATOR_DECISION_VALUES = [
  "approved",
  "rejected",
  "dismissed",
  "assigned",
  "reviewed",
  "completed",
  "verified",
  "model_review_requested",
  "conditions_recorded",
  "proposal_opened",
  "recovery_case_updated"
] as const;

export type OperatorDecisionValue = (typeof OPERATOR_DECISION_VALUES)[number];

export type CreateOperatorDecisionInput = {
  entityType: string;
  entityId: string;
  title: string;
  decision: OperatorDecisionValue;
  reason: string;
  conditions?: string | undefined;
  assignedReviewer?: string | undefined;
  expectedOutcome?: string | undefined;
  organisationId?: string | undefined;
  siteId?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
};

export type OperatorDecisionActor = {
  id: string;
  name: string;
  role: string;
};

export const createOperatorDecision = async (
  input: CreateOperatorDecisionInput,
  actor: OperatorDecisionActor
) => {
  if (!input.entityType.trim() || !input.entityId.trim()) {
    throw new AppError("entityType and entityId are required.", 400);
  }
  if (!input.reason.trim()) {
    throw new AppError("A decision reason is required.", 400);
  }

  const metadata = {
    title: input.title,
    decision: input.decision,
    reason: input.reason,
    conditions: input.conditions ?? null,
    assignedReviewer: input.assignedReviewer ?? null,
    expectedOutcome: input.expectedOutcome ?? null,
    actorName: actor.name,
    actorRole: actor.role,
    ...(input.metadata ?? {})
  };

  const row = await prisma.auditLog.create({
    data: {
      action: `operator.decision.${input.decision}`,
      entityType: input.entityType,
      entityId: input.entityId,
      message: `${input.decision}: ${input.title} — ${input.reason}`,
      metadata,
      userId: actor.id,
      ...(input.organisationId ? { organisationId: input.organisationId } : {}),
      ...(input.siteId ? { siteId: input.siteId } : {})
    }
  });

  return {
    id: row.id,
    entityType: row.entityType,
    entityId: row.entityId,
    action: row.action,
    message: row.message,
    metadata: row.metadata,
    userId: row.userId,
    createdAt: row.createdAt.toISOString()
  };
};

export const listOperatorDecisions = async (filters: {
  entityType?: string;
  entityId?: string;
  limit?: number;
}) => {
  const where: {
    action: { startsWith: string };
    entityType?: string;
    entityId?: string;
  } = {
    action: { startsWith: "operator.decision." }
  };
  if (filters.entityType) where.entityType = filters.entityType;
  if (filters.entityId) where.entityId = filters.entityId;

  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    take: Math.min(filters.limit ?? 100, 500),
    include: {
      user: { select: { id: true, name: true, email: true, role: true } }
    }
  });

  return rows.map((row) => ({
    id: row.id,
    entityType: row.entityType,
    entityId: row.entityId,
    action: row.action,
    decision: row.action.replace("operator.decision.", ""),
    message: row.message,
    metadata: row.metadata,
    userId: row.userId,
    user: row.user,
    createdAt: row.createdAt.toISOString()
  }));
};

export const recordLoginHistoryEntry = async (userId: string, limit = 50) => {
  const rows = await prisma.auditLog.findMany({
    where: {
      userId,
      action: { in: ["auth.login", "auth.logout", "auth.password.change", "auth.sessions.revoke_all"] }
    },
    orderBy: [{ createdAt: "desc" }],
    take: Math.min(limit, 200)
  });
  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    message: row.message,
    createdAt: row.createdAt.toISOString(),
    metadata: row.metadata
  }));
};
