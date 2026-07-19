import {
  AssetStatus,
  CommandApprovalDecision,
  CommandExecutionStatus,
  CommandOverrideState,
  CommandRequestStatus,
  CommandRiskLevel,
  CommandSource,
  MeasurementUnit,
  PlantStatus,
  Prisma
} from "@prisma/client";

import { env } from "../config/env.js";
import { canTransitionCommand } from "../domain/commands.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/AppError.js";
import { recordAuditLog } from "./audit-log.service.js";
import type { AccessActor } from "./access-scope.service.js";
import { getOptionalSiteAccessScope } from "./access-scope.service.js";
import {
  assertCommandNotExpired,
  assertCommandInRange,
  assertRampRate,
  assertSeparationOfDuties
} from "./command-validation.js";
import { runSimulatedCommandExecution } from "./simulated-command-executor.js";

export type CreateCommandRequestInput = {
  organisationId: string;
  siteId: string;
  plantId: string;
  targetAssetId: string;
  commandType: string;
  requestedValue: number;
  unit: MeasurementUnit;
  currentValue?: number;
  minimumAllowed?: number;
  maximumAllowed?: number;
  maxRampPerMinute?: number;
  reason: string;
  source?: CommandSource;
  riskLevel?: CommandRiskLevel;
  requireSeparationOfDuties?: boolean;
  optimisationRunId?: string;
  expiresAt: Date | string;
  advisoryOnly?: boolean;
  metadata?: unknown;
};


const optionalUserId = (userId?: string): { userId?: string } =>
  userId ? { userId } : {};

const assertTransition = (from: CommandRequestStatus, to: CommandRequestStatus) => {
  if (!canTransitionCommand(from, to)) {
    throw new AppError(`Invalid command transition from ${from} to ${to}.`, 409);
  }
};

const auditTransition = async (input: {
  commandId: string;
  from: CommandRequestStatus;
  to: CommandRequestStatus;
  userId?: string;
  organisationId: string;
  siteId: string;
  message?: string;
  metadata?: unknown;
}) => {
  await recordAuditLog({
    action: `command.${input.from}->${input.to}`,
    entityType: "CommandRequest",
    entityId: input.commandId,
    message: input.message ?? `Command transitioned from ${input.from} to ${input.to}`,
    ...(input.userId ? { userId: input.userId } : {}),
    organisationId: input.organisationId,
    siteId: input.siteId,
    metadata: {
      from: input.from,
      to: input.to,
      ...(input.metadata && typeof input.metadata === "object" ? (input.metadata as object) : {})
    }
  });
};

const loadCommandOrThrow = async (id: string) => {
  const command = await prisma.commandRequest.findUnique({
    where: { id },
    include: {
      targetAsset: { include: { state: true } },
      plant: true,
      approvals: { orderBy: { timestamp: "desc" } },
      executions: { orderBy: { createdAt: "desc" } }
    }
  });
  if (!command) {
    throw new AppError("Command request not found.", 404);
  }
  return command;
};

const assertSiteAccess = async (actor: AccessActor | undefined, siteId: string) => {
  const scope = await getOptionalSiteAccessScope(actor);
  if (scope.kind === "site" && scope.siteId !== siteId) {
    throw new AppError("Cross-tenant command access denied.", 403);
  }
};

const assertAssetAndPlantReady = (command: {
  plant: { status: PlantStatus };
  targetAsset: { status: AssetStatus; state: { available: boolean; operatingState: string } | null };
  overrideState: CommandOverrideState;
}) => {
  if (command.overrideState === "emergency_stop" || command.overrideState === "safe_state") {
    throw new AppError(`Command blocked by override state: ${command.overrideState}.`, 409);
  }
  if (command.plant.status === "decommissioned" || command.plant.status === "maintenance") {
    throw new AppError(`Plant status ${command.plant.status} does not allow commands.`, 409);
  }
  if (
    command.targetAsset.status === "decommissioned" ||
    command.targetAsset.status === "maintenance"
  ) {
    throw new AppError(`Asset status ${command.targetAsset.status} does not allow commands.`, 409);
  }
  if (command.targetAsset.state && command.targetAsset.state.available === false) {
    throw new AppError("Target asset is marked unavailable.", 409);
  }
};

export const createCommandRequest = async (
  input: CreateCommandRequestInput,
  actor?: AccessActor
) => {
  await assertSiteAccess(actor, input.siteId);

  const asset = await prisma.asset.findUnique({
    where: { id: input.targetAssetId },
    include: { plant: true, state: true }
  });
  if (!asset) {
    throw new AppError("Target asset not found.", 404);
  }
  if (asset.plantId !== input.plantId) {
    throw new AppError("targetAssetId does not belong to plantId.", 400);
  }
  if (asset.plant.siteId !== input.siteId || asset.plant.organisationId !== input.organisationId) {
    throw new AppError("Plant/site/organisation mismatch for target asset.", 400);
  }

  const expiresAt = new Date(input.expiresAt);
  assertCommandNotExpired({ expiresAt });
  assertCommandInRange(input);
  assertRampRate(input);

  const data: Prisma.CommandRequestUncheckedCreateInput = {
    organisationId: input.organisationId,
    siteId: input.siteId,
    plantId: input.plantId,
    targetAssetId: input.targetAssetId,
    commandType: input.commandType,
    requestedValue: input.requestedValue,
    unit: input.unit,
    reason: input.reason,
    expiresAt,
    source: input.source ?? "operator",
    riskLevel: input.riskLevel ?? "medium",
    requireSeparationOfDuties: input.requireSeparationOfDuties ?? true,
    advisoryOnly: input.advisoryOnly ?? true,
    status: "proposed"
  };

  if (typeof input.currentValue === "number") data.currentValue = input.currentValue;
  if (typeof input.minimumAllowed === "number") data.minimumAllowed = input.minimumAllowed;
  if (typeof input.maximumAllowed === "number") data.maximumAllowed = input.maximumAllowed;
  if (typeof input.maxRampPerMinute === "number") data.maxRampPerMinute = input.maxRampPerMinute;
  if (typeof input.optimisationRunId === "string") data.optimisationRunId = input.optimisationRunId;
  if (actor?.id) data.requestedById = actor.id;
  if (input.metadata !== undefined) data.metadata = input.metadata as Prisma.InputJsonValue;

  const created = await prisma.commandRequest.create({ data });

  await recordAuditLog({
    action: "command.proposed",
    entityType: "CommandRequest",
    entityId: created.id,
    message: `Command ${created.commandType} proposed`,
    ...optionalUserId(actor?.id),
    organisationId: created.organisationId,
    siteId: created.siteId,
    metadata: {
      source: created.source,
      riskLevel: created.riskLevel,
      advisoryOnly: created.advisoryOnly
    }
  });

  return created;
};

export const listCommandRequests = async (
  filters: { status?: CommandRequestStatus; plantId?: string; siteId?: string } = {},
  actor?: AccessActor
) => {
  const scope = await getOptionalSiteAccessScope(actor);
  const where: Prisma.CommandRequestWhereInput = {};
  if (scope.kind === "site") {
    where.siteId = scope.siteId;
  } else if (filters.siteId) {
    where.siteId = filters.siteId;
  }
  if (filters.status) where.status = filters.status;
  if (filters.plantId) where.plantId = filters.plantId;

  return prisma.commandRequest.findMany({
    where,
    orderBy: { requestedAt: "desc" },
    take: 100,
    include: {
      approvals: { orderBy: { timestamp: "desc" }, take: 5 },
      executions: { orderBy: { createdAt: "desc" }, take: 3 }
    }
  });
};

export const getCommandRequest = async (id: string, actor?: AccessActor) => {
  const command = await loadCommandOrThrow(id);
  await assertSiteAccess(actor, command.siteId);
  return command;
};

export const submitCommandForApproval = async (id: string, actor?: AccessActor) => {
  const command = await loadCommandOrThrow(id);
  await assertSiteAccess(actor, command.siteId);
  assertTransition(command.status, "pending_approval");
  assertCommandNotExpired({ expiresAt: command.expiresAt });
  assertAssetAndPlantReady(command);

  const updated = await prisma.commandRequest.update({
    where: { id },
    data: { status: "pending_approval" }
  });
  await auditTransition({
    commandId: id,
    from: command.status,
    to: "pending_approval",
    ...optionalUserId(actor?.id),
    organisationId: command.organisationId,
    siteId: command.siteId
  });
  return updated;
};

export const decideCommandApproval = async (
  id: string,
  decision: CommandApprovalDecision,
  reason: string | undefined,
  actor: AccessActor
) => {
  const command = await loadCommandOrThrow(id);
  await assertSiteAccess(actor, command.siteId);
  assertCommandNotExpired({ expiresAt: command.expiresAt });

  const nextStatus: CommandRequestStatus = decision === "approved" ? "approved" : "rejected";
  assertTransition(command.status, nextStatus);

  assertSeparationOfDuties({
    requesterId: command.requestedById,
    approverId: actor.id,
    requireSeparationOfDuties: command.requireSeparationOfDuties,
    riskLevel: command.riskLevel
  });

  if (decision === "approved") {
    assertCommandInRange({
      requestedValue: command.requestedValue,
      minimumAllowed: command.minimumAllowed,
      maximumAllowed: command.maximumAllowed
    });
    assertRampRate({
      requestedValue: command.requestedValue,
      currentValue: command.currentValue,
      maxRampPerMinute: command.maxRampPerMinute
    });
    assertAssetAndPlantReady(command);
  }

  const [, updated] = await prisma.$transaction([
    prisma.commandApproval.create({
      data: {
        commandRequestId: id,
        approverId: actor.id,
        decision,
        reason: reason ?? null
      }
    }),
    prisma.commandRequest.update({
      where: { id },
      data: { status: nextStatus }
    })
  ]);

  await auditTransition({
    commandId: id,
    from: command.status,
    to: nextStatus,
    userId: actor.id,
    organisationId: command.organisationId,
    siteId: command.siteId,
    ...(reason ? { message: reason } : {}),
    metadata: { decision }
  });

  return updated;
};

export const cancelCommandRequest = async (
  id: string,
  reason: string | undefined,
  actor?: AccessActor,
  emergency = false
) => {
  const command = await loadCommandOrThrow(id);
  await assertSiteAccess(actor, command.siteId);
  assertTransition(command.status, "cancelled");

  const updated = await prisma.commandRequest.update({
    where: { id },
    data: {
      status: "cancelled",
      overrideState: emergency ? "emergency_stop" : command.overrideState
    }
  });

  await auditTransition({
    commandId: id,
    from: command.status,
    to: "cancelled",
    ...optionalUserId(actor?.id),
    organisationId: command.organisationId,
    siteId: command.siteId,
    message: reason ?? (emergency ? "Emergency cancellation" : "Cancelled"),
    metadata: { emergency }
  });

  return updated;
};

export const setCommandOverrideState = async (
  id: string,
  overrideState: CommandOverrideState,
  actor?: AccessActor
) => {
  const command = await loadCommandOrThrow(id);
  await assertSiteAccess(actor, command.siteId);

  const updated = await prisma.commandRequest.update({
    where: { id },
    data: { overrideState }
  });

  await recordAuditLog({
    action: "command.override",
    entityType: "CommandRequest",
    entityId: id,
    message: `Override state set to ${overrideState}`,
    ...optionalUserId(actor?.id),
    organisationId: command.organisationId,
    siteId: command.siteId,
    metadata: { overrideState, previous: command.overrideState }
  });

  return updated;
};

export const expireCommandIfNeeded = async (id: string) => {
  const command = await loadCommandOrThrow(id);
  if (command.expiresAt.getTime() > Date.now()) {
    return command;
  }
  if (!canTransitionCommand(command.status, "expired")) {
    return command;
  }
  const updated = await prisma.commandRequest.update({
    where: { id },
    data: { status: "expired" }
  });
  await auditTransition({
    commandId: id,
    from: command.status,
    to: "expired",
    organisationId: command.organisationId,
    siteId: command.siteId
  });
  return updated;
};

/**
 * Queue and run the simulated executor only.
 * Physical adapters are never invoked while PHYSICAL_COMMAND_EXECUTION_ENABLED is false.
 */
export const executeApprovedCommand = async (id: string, actor?: AccessActor) => {
  if (env.PHYSICAL_COMMAND_EXECUTION_ENABLED) {
    throw new AppError(
      "Physical command execution is not available. Disable PHYSICAL_COMMAND_EXECUTION_ENABLED and use the simulated executor until HIL validation.",
      503
    );
  }

  const command = await loadCommandOrThrow(id);
  await assertSiteAccess(actor, command.siteId);
  assertCommandNotExpired({ expiresAt: command.expiresAt });
  assertAssetAndPlantReady(command);
  assertTransition(command.status, "queued");

  if (command.status !== "approved") {
    throw new AppError("Only approved commands can be executed.", 409);
  }

  await prisma.commandRequest.update({
    where: { id },
    data: { status: "queued" }
  });
  await auditTransition({
    commandId: id,
    from: "approved",
    to: "queued",
    ...optionalUserId(actor?.id),
    organisationId: command.organisationId,
    siteId: command.siteId
  });

  const execution = await prisma.commandExecution.create({
    data: {
      commandRequestId: id,
      executorMode: "simulated",
      status: CommandExecutionStatus.queued,
      expectedValue: command.requestedValue
    }
  });

  const result = await runSimulatedCommandExecution({
    commandId: id,
    executionId: execution.id,
    expectedValue: command.requestedValue,
    currentValue: command.currentValue,
    advisoryOnly: command.advisoryOnly
  });

  return result;
};

export const isPhysicalExecutionEnabled = (): boolean => env.PHYSICAL_COMMAND_EXECUTION_ENABLED;
