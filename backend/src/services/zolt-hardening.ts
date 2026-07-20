import type { Role } from "@prisma/client";
import { z } from "zod";

import { env } from "../config/env.js";
import {
  assertOrganisationAccess,
  assertSiteAccess,
  resolveAccessScope,
  type AccessScope
} from "../middleware/permissions.js";
import { AppError } from "../utils/AppError.js";
import { logger } from "../utils/logger.js";

export const ZOLT_SYSTEM_SAFETY =
  "You are Zolt AI, the GridFlex assistant for energy operations. " +
  "Use available tools before giving operational conclusions. " +
  "Alarms and command proposals are advisory only — they do not replace protection relays, PPC, or BMS. " +
  "Never claim to have executed a physical plant command. PHYSICAL_COMMAND_EXECUTION_ENABLED is false. " +
  "Use concise, practical language and call out uncertainty when data is partial.";

const SECRET_PATTERNS: RegExp[] = [
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
  /\bsk-[A-Za-z0-9]{20,}\b/g,
  /(?:api[_-]?key|password|secret|token|authorization)\s*[:=]\s*\S+/gi,
  /-----BEGIN [A-Z ]+-----[\s\S]*?-----END [A-Z ]+-----/g
];

export const redactSecrets = (input: string): string => {
  let redacted = input;
  for (const pattern of SECRET_PATTERNS) {
    redacted = redacted.replace(pattern, "[REDACTED]");
  }
  return redacted;
};

export const redactUnknown = (value: unknown): unknown => {
  if (typeof value === "string") {
    return redactSecrets(value);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => redactUnknown(entry));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, redactUnknown(entry)])
    );
  }
  return value;
};

export const logZoltToolUse = (
  toolName: string,
  userId: string,
  meta?: Record<string, unknown>
): void => {
  logger.info("Zolt tool invocation.", {
    toolName,
    userId,
    ...(meta ?? {})
  });
};

export const zoltPrepareStep = ({ stepNumber }: { stepNumber: number }) => {
  if (stepNumber === 0) {
    return { toolChoice: "required" as const };
  }
  return {};
};

export const wrapToolExecute = <TArgs, TResult>(
  toolName: string,
  userId: string,
  execute: (args: TArgs) => Promise<TResult>
) => {
  return async (args: TArgs): Promise<TResult> => {
    logZoltToolUse(toolName, userId);
    return execute(args);
  };
};

export const proposeCommandInputSchema = z.object({
  organisationId: z.string().min(1),
  siteId: z.string().min(1),
  plantId: z.string().optional(),
  assetId: z.string().optional(),
  commandType: z.string().min(1).max(120),
  parameters: z.record(z.unknown()).optional(),
  rationale: z.string().min(1).max(2000)
});

export type ProposeCommandInput = z.infer<typeof proposeCommandInputSchema>;

export const resolveZoltAccessScope = async (userId: string, role: Role): Promise<AccessScope> =>
  resolveAccessScope(userId, role);

export const proposeCommandOnly = async (
  input: ProposeCommandInput,
  actor: { id: string; role: string },
  scope: AccessScope
) => {
  if (env.PHYSICAL_COMMAND_EXECUTION_ENABLED) {
    throw new AppError("Physical command execution must remain disabled. Zolt can only propose commands.", 503);
  }

  assertOrganisationAccess(scope, input.organisationId);
  await assertSiteAccess(scope, input.siteId);

  const proposal: {
    organisationId: string;
    siteId: string;
    commandType: string;
    rationale: string;
    plantId?: string;
    assetId?: string;
    parameters?: Record<string, unknown>;
  } = {
    organisationId: input.organisationId,
    siteId: input.siteId,
    commandType: input.commandType,
    rationale: input.rationale
  };
  if (input.plantId) proposal.plantId = input.plantId;
  if (input.assetId) proposal.assetId = input.assetId;
  if (input.parameters !== undefined) proposal.parameters = input.parameters;

  logZoltToolUse("proposeCommand", actor.id, {
    siteId: input.siteId,
    commandType: input.commandType,
    executed: false
  });

  return {
    status: "proposal_only" as const,
    executed: false,
    physicalCommandExecutionEnabled: false,
    proposedBy: actor.id,
    proposal,
    disclaimer:
      "This is an advisory command proposal only. No physical action was taken. " +
      "Operator approval and plant safety interlocks are required before any execution."
  };
};
