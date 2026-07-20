import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

export type AlertSeverity = "info" | "warning" | "critical";

export type AlertDispatchPayload = {
  alertId: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
  traceId?: string;
  organisationId?: string;
  firedAt?: string;
};

const lastSentAt = new Map<string, number>();

/**
 * Deliver critical/warning alerts to the configured webhook (Slack/PagerDuty/generic).
 * No-op when ALERT_WEBHOOK_URL is unset.
 */
export async function dispatchAlert(payload: AlertDispatchPayload): Promise<{ delivered: boolean; skipped?: string }> {
  const url = env.ALERT_WEBHOOK_URL?.trim();
  if (!url || !env.ALERT_WEBHOOK_ENABLED) {
    return { delivered: false, skipped: "webhook_disabled" };
  }

  if (payload.severity === "info" && !env.ALERT_WEBHOOK_INCLUDE_INFO) {
    return { delivered: false, skipped: "info_suppressed" };
  }

  const cooldownMs = env.ALERT_WEBHOOK_COOLDOWN_MS;
  const last = lastSentAt.get(payload.alertId) ?? 0;
  if (Date.now() - last < cooldownMs) {
    return { delivered: false, skipped: "cooldown" };
  }

  const body = {
    ...payload,
    firedAt: payload.firedAt ?? new Date().toISOString(),
    service: env.OTEL_SERVICE_NAME ?? "gridflex-api",
    environment: env.NODE_ENV,
    operatingMode: env.GRIDFLEX_OPERATING_MODE
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(env.ALERT_WEBHOOK_TOKEN
          ? { authorization: `Bearer ${env.ALERT_WEBHOOK_TOKEN}` }
          : {})
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(env.ALERT_WEBHOOK_TIMEOUT_MS)
    });

    if (!response.ok) {
      logger.warn("alert.webhook.failed", {
        event: "alert.webhook.failed",
        alertId: payload.alertId,
        status: response.status
      });
      return { delivered: false, skipped: `http_${response.status}` };
    }

    lastSentAt.set(payload.alertId, Date.now());
    logger.info("alert.webhook.delivered", {
      event: "alert.webhook.delivered",
      alertId: payload.alertId,
      severity: payload.severity
    });
    return { delivered: true };
  } catch (error) {
    logger.warn("alert.webhook.error", {
      event: "alert.webhook.error",
      alertId: payload.alertId,
      error: error instanceof Error ? error.message : String(error)
    });
    return { delivered: false, skipped: "error" };
  }
}
