/**
 * Local safety-controller abstraction.
 * Cloud advisory systems cannot override signed local hard limits.
 * This module does not depend on Zolt AI.
 */

export type SignedLocalLimits = {
  version: string;
  siteId: string;
  deviceId: string;
  /** HMAC or signature material over the limits payload (opaque to this layer). */
  signature: string;
  signedAt: string;
  minimumAllowed: number;
  maximumAllowed: number;
  maxRampPerMinute?: number;
  interlocks: string[];
};

export type SignedCommandPackage = {
  commandId: string;
  siteId: string;
  deviceId: string;
  commandType: string;
  requestedValue: number;
  expiresAt: string;
  /** Opaque signature over the command package. */
  signature: string;
  expectedLimitsVersion: string;
};

export type SafetyControllerContext = {
  communicationHealthy: boolean;
  currentValue: number;
  activeInterlocks: string[];
  limits: SignedLocalLimits;
  now?: Date;
};

export type SafetyDecision =
  | {
      allowed: true;
      appliedValue: number;
      reason: string;
    }
  | {
      allowed: false;
      reason: string;
      safeState?: "hold" | "trip" | "ramp_to_safe";
    };

export type SafetyExecutionReport = {
  commandId: string;
  acknowledged: boolean;
  verified: boolean;
  expectedValue: number;
  readBackValue?: number;
  failureReason?: string;
  rolledBack: boolean;
  enteredSafeState: boolean;
};

const isExpired = (expiresAt: string, now: Date): boolean =>
  new Date(expiresAt).getTime() <= now.getTime();

/**
 * Validate a signed command package against local limits without sending anything.
 */
export const evaluateLocalSafety = (
  command: SignedCommandPackage,
  ctx: SafetyControllerContext
): SafetyDecision => {
  const now = ctx.now ?? new Date();

  if (command.siteId !== ctx.limits.siteId || command.deviceId !== ctx.limits.deviceId) {
    return { allowed: false, reason: "Site or device identity mismatch.", safeState: "hold" };
  }

  if (command.expectedLimitsVersion !== ctx.limits.version) {
    return {
      allowed: false,
      reason: "Local limits version mismatch; cloud cannot override local hard limits.",
      safeState: "hold"
    };
  }

  if (!command.signature || !ctx.limits.signature) {
    return { allowed: false, reason: "Missing command or limits signature.", safeState: "hold" };
  }

  if (isExpired(command.expiresAt, now)) {
    return { allowed: false, reason: "Command package expired.", safeState: "hold" };
  }

  if (!ctx.communicationHealthy) {
    return {
      allowed: false,
      reason: "Communication unhealthy; entering defined safe state.",
      safeState: "trip"
    };
  }

  const blocking = ctx.activeInterlocks.filter((i) => ctx.limits.interlocks.includes(i));
  if (blocking.length > 0) {
    return {
      allowed: false,
      reason: `Interlock(s) active: ${blocking.join(", ")}`,
      safeState: "hold"
    };
  }

  if (command.requestedValue < ctx.limits.minimumAllowed) {
    return {
      allowed: false,
      reason: `Below local minimum ${ctx.limits.minimumAllowed}.`,
      safeState: "hold"
    };
  }
  if (command.requestedValue > ctx.limits.maximumAllowed) {
    return {
      allowed: false,
      reason: `Above local maximum ${ctx.limits.maximumAllowed}.`,
      safeState: "hold"
    };
  }

  if (typeof ctx.limits.maxRampPerMinute === "number") {
    const delta = Math.abs(command.requestedValue - ctx.currentValue);
    if (delta > ctx.limits.maxRampPerMinute + 1e-9) {
      return {
        allowed: false,
        reason: `Ramp ${delta} exceeds local maxRampPerMinute ${ctx.limits.maxRampPerMinute}.`,
        safeState: "ramp_to_safe"
      };
    }
  }

  return {
    allowed: true,
    appliedValue: command.requestedValue,
    reason: "Passed local identity, expiry, interlock, range and ramp checks."
  };
};

export type SafetyAdapter = {
  sendSetpoint: (value: number) => Promise<{ acknowledged: boolean; raw?: unknown }>;
  readBack: () => Promise<number>;
  enterSafeState: (mode: "hold" | "trip" | "ramp_to_safe") => Promise<void>;
};

/**
 * Apply a command through a local adapter after safety evaluation.
 * Physical adapters remain disabled by default at the gateway layer.
 */
export const applyWithLocalSafety = async (
  command: SignedCommandPackage,
  ctx: SafetyControllerContext,
  adapter: SafetyAdapter,
  options: { physicalEnabled: boolean; readBackTolerance?: number } = {
    physicalEnabled: false
  }
): Promise<SafetyExecutionReport> => {
  const decision = evaluateLocalSafety(command, ctx);
  if (!decision.allowed) {
    if (decision.safeState) {
      await adapter.enterSafeState(decision.safeState);
    }
    return {
      commandId: command.commandId,
      acknowledged: false,
      verified: false,
      expectedValue: command.requestedValue,
      failureReason: decision.reason,
      rolledBack: false,
      enteredSafeState: Boolean(decision.safeState)
    };
  }

  if (!options.physicalEnabled) {
    // Simulated local path: pretend write + exact read-back without protocol I/O.
    return {
      commandId: command.commandId,
      acknowledged: true,
      verified: true,
      expectedValue: decision.appliedValue,
      readBackValue: decision.appliedValue,
      rolledBack: false,
      enteredSafeState: false
    };
  }

  const send = await adapter.sendSetpoint(decision.appliedValue);
  if (!send.acknowledged) {
    await adapter.enterSafeState("hold");
    return {
      commandId: command.commandId,
      acknowledged: false,
      verified: false,
      expectedValue: decision.appliedValue,
      failureReason: "Adapter did not acknowledge write.",
      rolledBack: false,
      enteredSafeState: true
    };
  }

  const readBackValue = await adapter.readBack();
  const tolerance = options.readBackTolerance ?? 0;
  const verified = Math.abs(readBackValue - decision.appliedValue) <= tolerance;

  if (!verified) {
    try {
      await adapter.sendSetpoint(ctx.currentValue);
    } catch {
      await adapter.enterSafeState("trip");
      return {
        commandId: command.commandId,
        acknowledged: true,
        verified: false,
        expectedValue: decision.appliedValue,
        readBackValue,
        failureReason: "Read-back mismatch; rollback failed, entered safe state.",
        rolledBack: false,
        enteredSafeState: true
      };
    }
    return {
      commandId: command.commandId,
      acknowledged: true,
      verified: false,
      expectedValue: decision.appliedValue,
      readBackValue,
      failureReason: "Read-back mismatch; rolled back to previous value.",
      rolledBack: true,
      enteredSafeState: false
    };
  }

  return {
    commandId: command.commandId,
    acknowledged: true,
    verified: true,
    expectedValue: decision.appliedValue,
    readBackValue,
    rolledBack: false,
    enteredSafeState: false
  };
};
