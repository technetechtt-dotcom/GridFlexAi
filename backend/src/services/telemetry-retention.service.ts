import cron, { type ScheduledTask } from "node-cron";

import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { logger } from "../utils/logger.js";

export const purgeStaleTelemetryReadings = async (): Promise<{ deleted: number; skipped: boolean }> => {
  if (!env.TELEMETRY_RETENTION_PURGE_ENABLED) return { deleted: 0, skipped: true };
  const retentionDays = env.TELEMETRY_RETENTION_DAYS ?? 90;
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const result = await prisma.telemetryReading.deleteMany({ where: { ingestedAt: { lt: cutoff } } });
  logger.info("Telemetry retention purge completed.", { deleted: result.count, retentionDays });
  return { deleted: result.count, skipped: false };
};

export const startTelemetryRetentionCron = (): ScheduledTask | null => {
  if (!env.TELEMETRY_RETENTION_CRON_ENABLED) return null;
  return cron.schedule(env.TELEMETRY_RETENTION_CRON_SCHEDULE, () => {
    void purgeStaleTelemetryReadings().catch((error: unknown) => {
      logger.error("Telemetry retention cron failed.", { message: error instanceof Error ? error.message : "Unknown" });
    });
  }, { timezone: "UTC" });
};
