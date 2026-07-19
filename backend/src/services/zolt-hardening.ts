import type { Role } from "@prisma/client";
import { z } from "zod";

import { env } from "../config/env.js";
import { assertOrganisationAccess, assertSiteAccess, resolveAccessScope, type AccessScope } from "../middleware/permissions.js";
import { AppError } from "../utils/AppError.js";
import { logger } from "../utils/logger.js";

export const ZOLT_SYSTEM_SAFETY =
  "You are Zolt AI, the GridFlex assistant for energy operations. Use available tools before giving operational conclusions. " +
  "Alarms and command proposals are advisory only — they do not replace protection relays, PPC, or BMS. " +
  "Never claim to have executed a physical plant command. PHYSICAL_COMMAND_EXECUTION_ENABLED is false.";

const SECRET_PATTERNS: RegExp[] = [
  /Bearer\s+\S+/gi,
  /\bsk-[A-Za-z0-9]{20,}\b/g,
  /(?:api[_-]?key|password|secret|token)\s*[:=]\s*\S+/gi
];

export const redactSecrets = (input: string): string => {
  let redacted = input;
  for (const pattern of SECRET_PATTERNS) redacted = redacted.replace(pattern, "[REDACTED]");
  return redacted;
};

export const logZoltToolUse = (toolName: string, userId: string, meta?: Record<string, unknown>): void => {
  logger.info("Zolt tool invocation.", { toolName, userId, ...(meta ?? {}) });
};

export const zoltPrepareStep = ({ stepNumber }: { stepNumber: number }) =>
  stepNumber === 0 ? { toolChoice: "required" as const } : {};

export const wrapToolExecute = <TArgs, TResult>(toolName: string, userId: string, execute: (args: TArgs) => Promise<TResult>) =>
  async (args: TArgs) => { logZoltToolUse(toolName, userId); return execute(args); };

export const proposeCommandInputSchema = z.object({
  organisationId: z.string().min(1), siteId: z.string().min(1), plantId: z.string().optional(), assetId: z.string().optional(),
  commandType: z.string().min(1).max(120), parameters: z.record(z.unknown()).optional(), rationale: z.string().min(1).max(2000)
});

export type ProposeCommandInput = z.infer<typeof proposeCommandInputSchema>;

export const resolveZoltAccessScope = (userId: string, role: Role) => resolveAccessScope(userId, role);

export const proposeCommandOnly = async (input: ProposeCommandInput, actor: { id: string }, scope: AccessScope) => {
  if (env.PHYSICAL_COMMAND_EXECUTION_ENABLED) throw new AppError("Physical command execution must remain disabled.", 503);
  assertOrganisationAccess(scope, input.organisationId);
  await assertSiteAccess(scope, input.siteId);
  logZoltToolUse("proposeCommand", actor.id, { siteId: input.siteId, commandType: input.commandType, executed: false });
  const proposal: { organisationId: string; siteId: string; commandType: string; rationale: string; plantId?: string; assetId?: string; parameters?: Record<string, unknown> } = {
    organisationId: input.organisationId, siteId: input.siteId, commandType: input.commandType, rationale: input.rationale
  };
  if (input.plantId) proposal.plantId = input.plantId;
  if (input.assetId) proposal.assetId = input.assetId;
  if (input.parameters !== undefined) proposal.parameters = input.parameters;
  return { status: "proposal_only" as const, executed: false, physicalCommandExecutionEnabled: false, proposedBy: actor.id, proposal,
    disclaimer: "Advisory proposal only. No physical action was taken." };
};
