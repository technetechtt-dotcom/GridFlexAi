import {
  DataQuality,
  DataSourceType,
  Prisma,
  type ForecastAccuracyScore,
  type ForecastRun
} from "@prisma/client";

import { scoreForecast, type ForecastPoint } from "../domain/forecast/scoring.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/AppError.js";
import { recordAuditLog } from "./audit-log.service.js";
import type { AccessActor } from "./access-scope.service.js";
import { getOptionalSiteAccessScope } from "./access-scope.service.js";

const assertPlantAccess = async (plantId: string, actor?: AccessActor) => {
  const scope = await getOptionalSiteAccessScope(actor);
  const plant = await prisma.plant.findUnique({ where: { id: plantId } });
  if (!plant) throw new AppError("Plant not found.", 404);
  if (scope.kind === "site" && plant.siteId !== scope.siteId) {
    throw new AppError("Cross-tenant plant access denied.", 403);
  }
  return plant;
};

export const getPlantForecastConfig = async (plantId: string, actor?: AccessActor) => {
  await assertPlantAccess(plantId, actor);
  return prisma.plantForecastConfig.findUnique({ where: { plantId } });
};

export const upsertPlantForecastConfig = async (
  plantId: string,
  input: {
    dcCapacityKw: number;
    acCapacityKw: number;
    tiltDeg?: number;
    azimuthDeg?: number;
  },
  actorId?: string,
  actor?: AccessActor
) => {
  const plant = await assertPlantAccess(plantId, actor);
  const config = await prisma.plantForecastConfig.upsert({
    where: { plantId },
    create: {
      plantId,
      dcCapacityKw: input.dcCapacityKw,
      acCapacityKw: input.acCapacityKw,
      tiltDeg: input.tiltDeg ?? 20,
      azimuthDeg: input.azimuthDeg ?? 0
    },
    update: {
      dcCapacityKw: input.dcCapacityKw,
      acCapacityKw: input.acCapacityKw,
      ...(typeof input.tiltDeg === "number" ? { tiltDeg: input.tiltDeg } : {}),
      ...(typeof input.azimuthDeg === "number" ? { azimuthDeg: input.azimuthDeg } : {})
    }
  });

  await recordAuditLog({
    action: "forecast.config.upsert",
    entityType: "PlantForecastConfig",
    entityId: config.id,
    message: `Updated forecast config for plant ${plant.code}`,
    userId: actorId,
    organisationId: plant.organisationId,
    siteId: plant.siteId
  });

  return config;
};

export const listForecastRuns = async (
  filters: { plantId?: string; limit?: number },
  actor?: AccessActor
) => {
  const scope = await getOptionalSiteAccessScope(actor);
  const where: Prisma.ForecastRunWhereInput = {};
  if (scope.kind === "site") where.siteId = scope.siteId;
  if (filters.plantId) where.plantId = filters.plantId;

  return prisma.forecastRun.findMany({
    where,
    orderBy: [{ generatedAt: "desc" }],
    take: Math.min(filters.limit ?? 50, 200),
    include: {
      plant: { select: { id: true, name: true, code: true } },
      _count: { select: { values: true } }
    }
  });
};

export const createForecastRun = async (
  input: {
    plantId: string;
    provider: string;
    version: string;
    sourceType?: DataSourceType;
    quality?: DataQuality;
    validFrom: string;
    validTo: string;
    freshnessSeconds?: number;
    metadata?: unknown;
    values: Array<{
      targetTime: string;
      horizonMinutes: number;
      p10Kw?: number;
      p50Kw: number;
      p90Kw?: number;
      sourceType?: DataSourceType;
      quality?: DataQuality;
    }>;
  },
  actorId?: string,
  actor?: AccessActor
): Promise<ForecastRun> => {
  const plant = await assertPlantAccess(input.plantId, actor);
  if (input.values.length === 0) {
    throw new AppError("Forecast run requires at least one value.", 400);
  }

  const runData: Prisma.ForecastRunUncheckedCreateInput = {
    organisationId: plant.organisationId,
    siteId: plant.siteId,
    plantId: plant.id,
    provider: input.provider,
    version: input.version,
    sourceType: input.sourceType ?? DataSourceType.forecast,
    quality: input.quality ?? DataQuality.unverified,
    validFrom: new Date(input.validFrom),
    validTo: new Date(input.validTo),
    freshnessSeconds: input.freshnessSeconds ?? null,
    values: {
      create: input.values.map((value) => ({
        targetTime: new Date(value.targetTime),
        horizonMinutes: value.horizonMinutes,
        p10Kw: value.p10Kw ?? null,
        p50Kw: value.p50Kw,
        p90Kw: value.p90Kw ?? null,
        sourceType: value.sourceType ?? DataSourceType.forecast,
        quality: value.quality ?? DataQuality.unverified
      }))
    }
  };
  if (input.metadata !== undefined) {
    runData.metadata = input.metadata as Prisma.InputJsonValue;
  }

  const run = await prisma.forecastRun.create({
    data: runData,
    include: { values: true }
  });

  await recordAuditLog({
    action: "forecast.run.create",
    entityType: "ForecastRun",
    entityId: run.id,
    message: `Created forecast run ${input.provider}@${input.version} for plant ${plant.code}`,
    userId: actorId,
    organisationId: plant.organisationId,
    siteId: plant.siteId
  });

  return run;
};

export const listForecastAccuracyScores = async (
  filters: { plantId?: string; horizonMinutes?: number; limit?: number },
  actor?: AccessActor
) => {
  const scope = await getOptionalSiteAccessScope(actor);
  const where: Prisma.ForecastAccuracyScoreWhereInput = {};

  if (filters.plantId) {
    await assertPlantAccess(filters.plantId, actor);
    where.plantId = filters.plantId;
  } else if (scope.kind === "site") {
    where.plant = { siteId: scope.siteId };
  }

  if (typeof filters.horizonMinutes === "number") {
    where.horizonMinutes = filters.horizonMinutes;
  }

  return prisma.forecastAccuracyScore.findMany({
    where,
    orderBy: [{ scoredAt: "desc" }],
    take: Math.min(filters.limit ?? 50, 200),
    include: {
      plant: { select: { id: true, name: true, code: true, technology: true } }
    }
  });
};

export const scoreAndPersistForecastAccuracy = async (
  input: {
    plantId: string;
    horizonMinutes: number;
    provider?: string;
    periodStart: string;
    periodEnd: string;
    points: ForecastPoint[];
    metadata?: unknown;
  },
  actorId?: string,
  actor?: AccessActor
): Promise<ForecastAccuracyScore> => {
  const plant = await assertPlantAccess(input.plantId, actor);
  if (input.points.length === 0) {
    throw new AppError("At least one forecast/actual point is required.", 400);
  }

  const scored = scoreForecast(input.points);
  const scoreData: Prisma.ForecastAccuracyScoreUncheckedCreateInput = {
    plantId: plant.id,
    horizonMinutes: input.horizonMinutes,
    provider: input.provider ?? null,
    maeKw: scored.maeKw,
    rmseKw: scored.rmseKw,
    mapePercent: scored.mapePercent,
    biasKw: scored.biasKw,
    sampleCount: scored.samples,
    periodStart: new Date(input.periodStart),
    periodEnd: new Date(input.periodEnd)
  };
  if (input.metadata !== undefined) {
    scoreData.metadata = input.metadata as Prisma.InputJsonValue;
  }
  const row = await prisma.forecastAccuracyScore.create({ data: scoreData });

  await recordAuditLog({
    action: "forecast.accuracy.score",
    entityType: "ForecastAccuracyScore",
    entityId: row.id,
    message: `Scored forecast accuracy for plant ${plant.code}`,
    userId: actorId,
    organisationId: plant.organisationId,
    siteId: plant.siteId,
    metadata: { maeKw: row.maeKw, rmseKw: row.rmseKw, samples: row.sampleCount }
  });

  return row;
};
