import cron, { type ScheduledTask } from "node-cron";

import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { withDistributedJobLock } from "../lib/distributed-job-lock.js";
import { logger } from "../utils/logger.js";
import { getHybridForecast } from "./forecast.service.js";

type NodeWithLastReading = {
  id: string;
  latitude: number;
  longitude: number;
  readings: Array<{
    power: number;
  }>;
};

const toForecastDate = (dateValue: string) => {
  return new Date(`${dateValue}T00:00:00.000Z`);
};

const estimateCapacityKw = (node: NodeWithLastReading): number => {
  const latestPower = node.readings[0]?.power ?? 80;
  return Number(Math.min(100000, Math.max(50, latestPower * 2)).toFixed(2));
};

export const persistDailyForecastPredictions = async () => {
  const nodes = await prisma.edgeNode.findMany({
    where: {
      latitude: { not: null },
      longitude: { not: null }
    },
    select: {
      id: true,
      latitude: true,
      longitude: true,
      readings: {
        orderBy: [{ timestamp: "desc" }],
        take: 1,
        select: {
          power: true
        }
      }
    }
  }) as NodeWithLastReading[];

  if (!nodes.length) {
    logger.info("Forecast cron skipped: no geocoded nodes found.");
    return;
  }

  for (const node of nodes) {
    const forecast = await getHybridForecast({
      lat: node.latitude,
      lon: node.longitude,
      capacity: estimateCapacityKw(node)
    });

    for (const daily of forecast.daily) {
      await prisma.dailyForecastPrediction.upsert({
        where: {
          nodeId_forecastDate: {
            nodeId: node.id,
            forecastDate: toForecastDate(daily.date)
          }
        },
        update: {
          estimatedEnergyKwh: daily.estimatedEnergyKwh,
          peakPowerKw: daily.peakPowerKw,
          sourceConfidence: daily.sourceConfidence,
          generatedAt: new Date()
        },
        create: {
          nodeId: node.id,
          forecastDate: toForecastDate(daily.date),
          estimatedEnergyKwh: daily.estimatedEnergyKwh,
          peakPowerKw: daily.peakPowerKw,
          sourceConfidence: daily.sourceConfidence
        }
      });
    }
  }

  logger.info("Forecast cron persisted daily predictions.", {
    nodeCount: nodes.length
  });
};

export const startForecastCron = (): ScheduledTask | null => {
  if (!env.FORECAST_CRON_ENABLED) {
    logger.info("Forecast cron disabled via configuration.");
    return null;
  }

  const task = cron.schedule(
    env.FORECAST_CRON_SCHEDULE,
    () => {
      void withDistributedJobLock("forecast-cron", () => persistDailyForecastPredictions()).catch((error: unknown) => {
        const err = error instanceof Error ? error : new Error("Unknown forecast cron error");
        logger.error("Forecast cron job failed.", {
          message: err.message
        });
      });
    },
    {
      timezone: "UTC"
    }
  );

  logger.info("Forecast cron scheduled.", {
    schedule: env.FORECAST_CRON_SCHEDULE
  });

  return task;
};
