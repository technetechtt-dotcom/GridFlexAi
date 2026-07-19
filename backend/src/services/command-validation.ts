import { HIGH_RISK_LEVELS, type CommandRiskLevel } from "../domain/commands.js";
import { AppError } from "../utils/AppError.js";

export type CommandLimitsInput = {
  requestedValue: number;
  currentValue?: number | null;
  minimumAllowed?: number | null;
  maximumAllowed?: number | null;
  maxRampPerMinute?: number | null;
  /** Elapsed minutes since the last verified setpoint change; defaults to 1. */
  rampWindowMinutes?: number;
};

export type ExpiryInput = {
  expiresAt: Date;
  now?: Date;
};

export type SeparationOfDutiesInput = {
  requesterId?: string | null;
  approverId: string;
  requireSeparationOfDuties: boolean;
  riskLevel: CommandRiskLevel;
};

export const assertCommandNotExpired = (input: ExpiryInput): void => {
  const now = input.now ?? new Date();
  if (input.expiresAt.getTime() <= now.getTime()) {
    throw new AppError("Command request has expired.", 409);
  }
};

export const assertCommandInRange = (input: CommandLimitsInput): void => {
  const { requestedValue, minimumAllowed, maximumAllowed } = input;
  if (typeof minimumAllowed === "number" && requestedValue < minimumAllowed) {
    throw new AppError(
      `Requested value ${requestedValue} is below minimumAllowed ${minimumAllowed}.`,
      400
    );
  }
  if (typeof maximumAllowed === "number" && requestedValue > maximumAllowed) {
    throw new AppError(
      `Requested value ${requestedValue} is above maximumAllowed ${maximumAllowed}.`,
      400
    );
  }
};

export const assertRampRate = (input: CommandLimitsInput): void => {
  const { requestedValue, currentValue, maxRampPerMinute } = input;
  if (typeof maxRampPerMinute !== "number" || typeof currentValue !== "number") {
    return;
  }
  const windowMinutes = Math.max(input.rampWindowMinutes ?? 1, 1e-6);
  const delta = Math.abs(requestedValue - currentValue);
  const allowedDelta = maxRampPerMinute * windowMinutes;
  if (delta > allowedDelta + 1e-9) {
    throw new AppError(
      `Requested change ${delta} exceeds ramp limit ${allowedDelta} over ${windowMinutes} minute(s).`,
      400
    );
  }
};

export const assertSeparationOfDuties = (input: SeparationOfDutiesInput): void => {
  const enforce =
    input.requireSeparationOfDuties || HIGH_RISK_LEVELS.has(input.riskLevel);
  if (!enforce) {
    return;
  }
  if (input.requesterId && input.requesterId === input.approverId) {
    throw new AppError(
      "Separation of duties: requester cannot approve this command.",
      403
    );
  }
};

export const validateCommandPayload = (input: CommandLimitsInput & ExpiryInput): void => {
  assertCommandNotExpired(input);
  assertCommandInRange(input);
  assertRampRate(input);
};
