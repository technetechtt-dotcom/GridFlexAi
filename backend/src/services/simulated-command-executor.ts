import { CommandExecutionStatus, CommandRequestStatus, Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { recordAuditLog } from "./audit-log.service.js";

export type SimulatedExecutionInput = {
  commandId: string;
  executionId: string;
  expectedValue: number;
  currentValue?: number | null;
  advisoryOnly: boolean;
  /** Simulated read-back noise band; defaults to exact match. */
  readBackTolerance?: number;
};

/**
 * Simulated plant command executor for tests and advisory environments.
 * Never opens a physical protocol session.
 */
export const runSimulatedCommandExecution = async (input: SimulatedExecutionInput) => {
  const now = new Date();
  const readBackValue = input.expectedValue;
  const tolerance = input.readBackTolerance ?? 0;
  const verified = Math.abs(readBackValue - input.expectedValue) <= tolerance;

  const terminalStatus: CommandRequestStatus = verified ? "verified" : "failed";
  const executionStatus: CommandExecutionStatus = verified
    ? CommandExecutionStatus.verified
    : CommandExecutionStatus.failed;

  const rawProtocolResponse: Prisma.InputJsonValue = {
    mode: "simulated",
    advisoryOnly: input.advisoryOnly,
    note: "No physical adapter was invoked. PHYSICAL_COMMAND_EXECUTION_ENABLED remains false.",
    previousValue: input.currentValue ?? null,
    writtenValue: input.expectedValue,
    readBackValue
  };

  const [execution, command] = await prisma.$transaction([
    prisma.commandExecution.update({
      where: { id: input.executionId },
      data: {
        sentAt: now,
        acknowledgedAt: now,
        readBackAt: now,
        expectedValue: input.expectedValue,
        readBackValue,
        status: executionStatus,
        failureReason: verified ? null : "Simulated read-back mismatch",
        rollbackStatus: verified ? null : "not_required_simulated",
        rawProtocolResponse
      }
    }),
    prisma.commandRequest.update({
      where: { id: input.commandId },
      data: verified
        ? { status: terminalStatus, currentValue: readBackValue }
        : { status: terminalStatus }
    })
  ]);

  const commandMeta = await prisma.commandRequest.findUniqueOrThrow({
    where: { id: input.commandId },
    select: { organisationId: true, siteId: true }
  });

  await recordAuditLog({
    action: `command.queued->sent`,
    entityType: "CommandRequest",
    entityId: input.commandId,
    organisationId: commandMeta.organisationId,
    siteId: commandMeta.siteId,
    message: "Simulated send",
    metadata: { executionId: input.executionId, mode: "simulated" }
  });
  await recordAuditLog({
    action: `command.sent->acknowledged`,
    entityType: "CommandRequest",
    entityId: input.commandId,
    organisationId: commandMeta.organisationId,
    siteId: commandMeta.siteId,
    message: "Simulated acknowledgement",
    metadata: { executionId: input.executionId }
  });
  await recordAuditLog({
    action: `command.acknowledged->${terminalStatus}`,
    entityType: "CommandRequest",
    entityId: input.commandId,
    organisationId: commandMeta.organisationId,
    siteId: commandMeta.siteId,
    message: verified ? "Simulated read-back verified" : "Simulated verification failed",
    metadata: { executionId: input.executionId, readBackValue, expectedValue: input.expectedValue }
  });

  return { execution, command };
};
