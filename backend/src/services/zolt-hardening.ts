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
  "You are Zolt AI, the GridFlex assistant for energy operations. Use available tools before giving operational conclusions. " +
  "Alarms and command proposals are advisory only — they do not replace protection relays, PPC, or BMS. " +
  "Never claim to have executed a physical plant command. PHYSICAL_COMMAND_EXECUTION_ENABLED is false.";

const SECRET_PATTERNS: RegExp[] = [
  /Bearer\s+\S+/gi,
  /\bsk-[A-Za-z0-9]{20,}\b/g,
  /(?:api[_-]?key|password|secret|token)\s*[:=]\s*\S+/gi
];

const PROMPT_INJECTION_PATTERNS: RegExp[] = [
  /ignore (all )?(previous|prior|above) instructions/i,
  /disregard (the )?(system|safety) (prompt|message)/i,
  /you are now (?:in )?(?:DAN|developer|unrestricted) mode/i,
  /reveal (the )?(system|hidden) prompt/i,
  /execute (?:the )?(?:physical )?command/i,
  /approve (?:and )?execute/i
];

const MAX_PROMPT_CHARS = env.ZOLT_MAX_PROMPT_CHARS;
const MAX_TOKENS_PER_REQUEST = env.ZOLT_MAX_TOKENS_PER_REQUEST;
const MAX_EVIDENCE_FRESHNESS_SECONDS = env.ZOLT_MAX_EVIDENCE_FRESHNESS_SECONDS;

export const redactSecrets = (input: string): string => {
  let redacted = input;
  for (const pattern of SECRET_PATTERNS) redacted = redacted.replace(pattern, "[REDACTED]");
  return redacted;
};

export const detectPromptInjection = (input: string): boolean =>
  PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(input));

export const enforcePromptBoundaries = (userPrompt: string): string => {
  const sanitized = redactSecrets(userPrompt);
  if (detectPromptInjection(sanitized)) {
    throw new AppError("Prompt rejected: possible instruction override attempt.", 400);
  }
  if (sanitized.length > MAX_PROMPT_CHARS) {
    throw new AppError(`Prompt exceeds maximum length of ${MAX_PROMPT_CHARS} characters.`, 400);
  }
  return `--- USER REQUEST (untrusted) ---\n${sanitized}`;
};

export const evidenceBundleSchema = z.object({
  evidenceIds: z.array(z.string().min(1)).min(1).max(20),
  source: z.string().min(1).max(120),
  asOf: z.string().datetime().optional(),
  freshnessSeconds: z.coerce.number().int().min(0).max(86400).optional()
});

export type EvidenceBundle = z.infer<typeof evidenceBundleSchema>;

export const requireEvidenceBundle = (payload: unknown): EvidenceBundle => {
  const parsed = evidenceBundleSchema.safeParse(payload);
  if (!parsed.success) {
    throw new AppError("Tool response requires evidenceIds, source, and freshness metadata.", 400);
  }
  if (
    typeof parsed.data.freshnessSeconds === "number" &&
    parsed.data.freshnessSeconds > MAX_EVIDENCE_FRESHNESS_SECONDS
  ) {
    throw new AppError("Evidence is stale beyond configured freshness threshold.", 400);
  }
  return parsed.data;
};

export const assertZoltCostBudget = (usage?: {
  promptTokens?: number;
  completionTokens?: number;
}): void => {
  const total = (usage?.promptTokens ?? 0) + (usage?.completionTokens ?? 0);
  if (total > MAX_TOKENS_PER_REQUEST) {
    throw new AppError("Zolt token budget exceeded for this request.", 429);
  }
};

export const logZoltToolUse = (
  toolName: string,
  userId: string,
  meta?: Record<string, unknown>
): void => {
  logger.info("Zolt tool invocation.", { toolName, userId, ...(meta ?? {}) });
};

export const zoltPrepareStep = ({ stepNumber }: { stepNumber: number }) =>
  stepNumber === 0 ? { toolChoice: "required" as const } : {};

export const wrapToolExecute = <TArgs, TResult>(
  toolName: string,
  userId: string,
  execute: (args: TArgs) => Promise<TResult>
) => async (args: TArgs) => {
  logZoltToolUse(toolName, userId);
  return execute(args);
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

export const resolveZoltAccessScope = (userId: string, role: Role) =>
  resolveAccessScope(userId, role);

export const proposeCommandOnly = async (
  input: ProposeCommandInput,
  actor: { id: string },
  scope: AccessScope
) => {
  if (env.PHYSICAL_COMMAND_EXECUTION_ENABLED) {
    throw new AppError("Physical command execution must remain disabled.", 503);
  }
  assertOrganisationAccess(scope, input.organisationId);
  await assertSiteAccess(scope, input.siteId);
  logZoltToolUse("proposeCommand", actor.id, {
    siteId: input.siteId,
    commandType: input.commandType,
    executed: false
  });

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

  return {
    status: "proposal_only" as const,
    executed: false,
    physicalCommandExecutionEnabled: false,
    proposedBy: actor.id,
    proposal,
    disclaimer: "Advisory proposal only. No physical action was taken."
  };
};
