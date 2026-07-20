import { AsyncLocalStorage } from "node:async_hooks";
import { randomBytes } from "node:crypto";

export type LogContext = {
  requestId?: string;
  traceId?: string;
  spanId?: string;
  organisationId?: string;
  deviceId?: string;
  route?: string;
};

const storage = new AsyncLocalStorage<LogContext>();

export const runWithLogContext = <T>(ctx: LogContext, fn: () => T): T => storage.run({ ...ctx }, fn);

export const getLogContext = (): LogContext => storage.getStore() ?? {};

export const patchLogContext = (patch: Partial<LogContext>): void => {
  const current = storage.getStore();
  if (!current) return;
  Object.assign(current, patch);
};

/** Parse or create a W3C traceparent; returns hex traceId + spanId. */
export const resolveTraceIds = (traceparentHeader?: string | null): { traceId: string; spanId: string; traceparent: string } => {
  const incoming = traceparentHeader?.trim();
  if (incoming) {
    const parts = incoming.split("-");
    if (parts.length >= 4 && parts[1]?.length === 32 && parts[2]?.length === 16) {
      const spanId = randomBytes(8).toString("hex");
      const traceId = parts[1];
      return {
        traceId,
        spanId,
        traceparent: `00-${traceId}-${spanId}-01`
      };
    }
  }
  const traceId = randomBytes(16).toString("hex");
  const spanId = randomBytes(8).toString("hex");
  return {
    traceId,
    spanId,
    traceparent: `00-${traceId}-${spanId}-01`
  };
};
