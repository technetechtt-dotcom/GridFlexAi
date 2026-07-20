/**
 * Shared command lifecycle vocabulary for GridFlex AI advisory control architecture.
 * Physical plant actuation remains disabled until HIL validation and plant approval.
 */

export const COMMAND_REQUEST_STATUSES = [
  "proposed",
  "pending_approval",
  "approved",
  "rejected",
  "expired",
  "queued",
  "sent",
  "acknowledged",
  "verified",
  "failed",
  "rolled_back",
  "cancelled"
] as const;

export type CommandRequestStatus = (typeof COMMAND_REQUEST_STATUSES)[number];

export const COMMAND_SOURCES = ["operator", "zolt_ai", "optimisation", "system"] as const;
export type CommandSource = (typeof COMMAND_SOURCES)[number];

export const COMMAND_RISK_LEVELS = ["low", "medium", "high", "critical"] as const;
export type CommandRiskLevel = (typeof COMMAND_RISK_LEVELS)[number];

export const COMMAND_APPROVAL_DECISIONS = ["approved", "rejected"] as const;
export type CommandApprovalDecision = (typeof COMMAND_APPROVAL_DECISIONS)[number];

export const COMMAND_EXECUTION_STATUSES = [
  "queued",
  "sent",
  "acknowledged",
  "verified",
  "failed",
  "rolled_back",
  "cancelled"
] as const;

export type CommandExecutionStatus = (typeof COMMAND_EXECUTION_STATUSES)[number];

export const COMMAND_OVERRIDE_STATES = [
  "none",
  "manual_override",
  "emergency_stop",
  "safe_state"
] as const;

export type CommandOverrideState = (typeof COMMAND_OVERRIDE_STATES)[number];

/** Allowed status transitions for the advisory command state machine. */
export const COMMAND_TRANSITIONS: Record<CommandRequestStatus, readonly CommandRequestStatus[]> = {
  proposed: ["pending_approval", "cancelled", "expired"],
  pending_approval: ["approved", "rejected", "cancelled", "expired"],
  approved: ["queued", "cancelled", "expired"],
  rejected: [],
  expired: [],
  queued: ["sent", "failed", "cancelled"],
  sent: ["acknowledged", "failed", "cancelled"],
  acknowledged: ["verified", "failed", "rolled_back"],
  verified: [],
  failed: ["rolled_back", "cancelled"],
  rolled_back: [],
  cancelled: []
};

export const canTransitionCommand = (
  from: CommandRequestStatus,
  to: CommandRequestStatus
): boolean => COMMAND_TRANSITIONS[from].includes(to);

/** Risk levels that always require separation of duties when configured. */
export const HIGH_RISK_LEVELS: ReadonlySet<CommandRiskLevel> = new Set(["high", "critical"]);
