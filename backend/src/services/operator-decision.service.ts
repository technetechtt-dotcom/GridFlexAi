import { Prisma } from "@prisma/client";

import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/AppError.js";
import { recordAuditLog } from "./audit-log.service.js";

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
  previousState?: string | undefined;
  newState?: string | undefined;
  conditions?: string | undefined;
  assignedReviewer?: string | undefined;
  expectedOutcome?: string | undefined;
  organisationId?: string | undefined;
  siteId?: string | undefined;
  relatedAlarmId?: string | undefined;
  relatedRecoveryCaseId?: string | undefined;
  modelVersion?: string | undefined;
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

  const data: Prisma.OperatorDecisionUncheckedCreateInput = {
    entityType: input.entityType,
    entityId: input.entityId,
    title: input.title,
    decision: input.decision,
    reason: input.reason,
    actorUserId: actor.id,
    actorRole: actor.role,
    releaseGitSha: env.RELEASE_GIT_SHA?.trim() || null
  };
  if (input.previousState) data.previousState = input.previousState;
  if (input.newState) data.newState = input.newState;
  if (input.conditions) data.conditions = input.conditions;
  if (input.assignedReviewer) data.assignedReviewer = input.assignedReviewer;
  if (input.expectedOutcome) data.expectedOutcome = input.expectedOutcome;
  if (input.organisationId) data.organisationId = input.organisationId;
  if (input.siteId) data.siteId = input.siteId;
  if (input.relatedAlarmId) data.relatedAlarmId = input.relatedAlarmId;
  if (input.relatedRecoveryCaseId) data.relatedRecoveryCaseId = input.relatedRecoveryCaseId;
  if (input.modelVersion) data.modelVersion = input.modelVersion;
  if (input.metadata !== undefined) data.metadata = input.metadata as Prisma.InputJsonValue;

  const row = await prisma.operatorDecision.create({ data });

  await recordAuditLog({
    action: `operator.decision.${input.decision}`,
    entityType: input.entityType,
    entityId: input.entityId,
    message: `${input.decision}: ${input.title} — ${input.reason}`,
    userId: actor.id,
    organisationId: input.organisationId,
    siteId: input.siteId,
    metadata: {
      decisionId: row.id,
      previousState: input.previousState ?? null,
      newState: input.newState ?? null,
      releaseGitSha: row.releaseGitSha
    }
  });

  return {
    id: row.id,
    entityType: row.entityType,
    entityId: row.entityId,
    action: `operator.decision.${row.decision}`,
    decision: row.decision,
    message: `${row.decision}: ${row.title}`,
    metadata: {
      title: row.title,
      reason: row.reason,
      conditions: row.conditions,
      assignedReviewer: row.assignedReviewer,
      expectedOutcome: row.expectedOutcome,
      previousState: row.previousState,
      newState: row.newState,
      releaseGitSha: row.releaseGitSha,
      modelVersion: row.modelVersion,
      actorName: actor.name,
      actorRole: actor.role
    },
    userId: row.actorUserId,
    createdAt: row.createdAt.toISOString()
  };
};

export const listOperatorDecisions = async (filters: {
  entityType?: string;
  entityId?: string;
  limit?: number;
}) => {
  const where: Prisma.OperatorDecisionWhereInput = {};
  if (filters.entityType) where.entityType = filters.entityType;
  if (filters.entityId) where.entityId = filters.entityId;

  const rows = await prisma.operatorDecision.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    take: Math.min(filters.limit ?? 100, 500),
    include: {
      actor: { select: { id: true, name: true, email: true, role: true } }
    }
  });

  return rows.map((row) => ({
    id: row.id,
    entityType: row.entityType,
    entityId: row.entityId,
    action: `operator.decision.${row.decision}`,
    decision: row.decision,
    message: `${row.decision}: ${row.title} — ${row.reason}`,
    metadata: {
      title: row.title,
      reason: row.reason,
      conditions: row.conditions,
      assignedReviewer: row.assignedReviewer,
      expectedOutcome: row.expectedOutcome,
      previousState: row.previousState,
      newState: row.newState,
      releaseGitSha: row.releaseGitSha,
      modelVersion: row.modelVersion
    },
    userId: row.actorUserId,
    user: row.actor,
    createdAt: row.createdAt.toISOString()
  }));
};

export const recordLoginHistoryEntry = async (userId: string, limit = 50) => {
  const rows = await prisma.auditLog.findMany({
    where: {
      userId,
      action: {
        in: ["auth.login", "auth.logout", "auth.password.change", "auth.sessions.revoke_all"]
      }
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
