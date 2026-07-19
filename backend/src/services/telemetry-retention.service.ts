import cron, { type ScheduledTask } from "node-cron";

import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { purgeExpiredTelemetry } from "./telemetry.service.js";

export const purgeStaleTelemetryReadings = async (): Promise<{
  deleted: number;
  skipped: boolean;
  cutoff?: string;
  retentionDays?: number;
}> => {
  if (!env.TELEMETRY_RETENTION_PURGE_ENABLED) {
    logger.info("Telemetry retention purge skipped: TELEMETRY_RETENTION_PURGE_ENABLED is false.");
    return { deleted: 0, skipped: true };
  }

  const result = await purgeExpiredTelemetry(env.TELEMETRY_RETENTION_DAYS);

  logger.info("Telemetry retention purge completed.", {
    deleted: result.deleted,
    retentionDays: result.retentionDays,
    cutoff: result.cutoff
  });

  return {
    deleted: result.deleted,
    skipped: false,
    cutoff: result.cutoff,
    retentionDays: result.retentionDays
  };
};

export const startTelemetryRetentionCron = (): ScheduledTask | null => {
  if (!env.TELEMETRY_RETENTION_CRON_ENABLED) {
    logger.info("Telemetry retention cron disabled via configuration.");
    return null;
  }

  const task = cron.schedule(
    env.TELEMETRY_RETENTION_CRON_SCHEDULE,
    () => {
      void purgeStaleTelemetryReadings().catch((error: unknown) => {
        const err = error instanceof Error ? error : new Error("Unknown telemetry retention cron error");
        logger.error("Telemetry retention cron job failed.", {
          message: err.message
        });
      });
    },
    {
      timezone: "UTC"
    }
  );

  logger.info("Telemetry retention cron scheduled.", {
    schedule: env.TELEMETRY_RETENTION_CRON_SCHEDULE,
    purgeEnabled: env.TELEMETRY_RETENTION_PURGE_ENABLED
  });

  return task;
};
