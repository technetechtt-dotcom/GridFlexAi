import { env } from "../config/env.js";
import { getLogContext } from "../observability/log-context.js";
import { redactMeta } from "../observability/redact.js";

type LogLevel = "debug" | "info" | "warn" | "error";

export type StructuredLogFields = {
  timestamp: string;
  level: LogLevel;
  service: string;
  environment: string;
  message: string;
  requestId?: string;
  traceId?: string;
  spanId?: string;
  organisationId?: string;
  deviceId?: string;
  event?: string;
  durationMs?: number;
  [key: string]: unknown;
};

const SERVICE = process.env.OTEL_SERVICE_NAME?.trim() || "gridflex-api";

const write = (level: LogLevel, message: string, meta?: Record<string, unknown>) => {
  const ctx = getLogContext();
  const safeMeta = redactMeta(meta) ?? {};
  const payload: StructuredLogFields = {
    timestamp: new Date().toISOString(),
    level,
    service: SERVICE,
    environment: env.NODE_ENV,
    message: typeof message === "string" ? message : String(message),
    ...(ctx.requestId ? { requestId: ctx.requestId } : {}),
    ...(ctx.traceId ? { traceId: ctx.traceId } : {}),
    ...(ctx.spanId ? { spanId: ctx.spanId } : {}),
    ...(ctx.organisationId ? { organisationId: ctx.organisationId } : {}),
    ...(ctx.deviceId ? { deviceId: ctx.deviceId } : {}),
    ...safeMeta
  };

  const line = JSON.stringify(payload);
  if (level === "error") {
    // eslint-disable-next-line no-console
    console.error(line);
    return;
  }
  if (level === "warn") {
    // eslint-disable-next-line no-console
    console.warn(line);
    return;
  }
  // eslint-disable-next-line no-console
  console.log(line);
};

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => write("debug", message, meta),
  info: (message: string, meta?: Record<string, unknown>) => write("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => write("warn", message, meta),
  error: (message: string, meta?: Record<string, unknown>) => write("error", message, meta),
  /** Prefer event-oriented logs for ops dashboards. */
  event: (event: string, meta?: Record<string, unknown>) =>
    write("info", event, { event, ...(meta ?? {}) })
};
