import type { Request, Response } from "express";

import { env } from "../config/env.js";
import { getRedisClient } from "../lib/redis.js";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";

type DependencyStatus = { database: "up" | "down"; redis: "up" | "down" | "disabled" };
type HealthResponse = { status: "ok" | "degraded"; uptime: number; timestamp: string; dependencies: DependencyStatus };
type ReadinessResponse = { status: "ready" | "not_ready"; checks: { database: "up" | "down" }; logging: "structured_json"; physicalCommandExecutionEnabled: boolean };

export const getLiveness = asyncHandler(async (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", uptime: process.uptime(), timestamp: new Date().toISOString() });
});

export const getReadiness = asyncHandler(async (_req: Request, res: Response<ReadinessResponse>) => {
  let database: "up" | "down" = "up";
  try { await prisma.$queryRaw`SELECT 1`; } catch { database = "down"; }
  res.status(database === "up" ? 200 : 503).json({
    status: database === "up" ? "ready" : "not_ready",
    checks: { database },
    logging: "structured_json",
    physicalCommandExecutionEnabled: env.PHYSICAL_COMMAND_EXECUTION_ENABLED
  });
});

export const getHealth = asyncHandler(async (_req: Request, res: Response<HealthResponse>) => {
  let database: DependencyStatus["database"] = "up";
  try { await prisma.$queryRaw`SELECT 1`; } catch { database = "down"; }
  let redisStatus: DependencyStatus["redis"] = "disabled";
  if (env.NODE_ENV !== "test") {
    const redisClient = getRedisClient();
    if (redisClient) {
      try {
        if (redisClient.status !== "ready") await redisClient.connect();
        await redisClient.ping();
        redisStatus = "up";
      } catch { redisStatus = "down"; }
    }
  }
  const degraded = database === "down" || redisStatus === "down";
  res.status(degraded ? 503 : 200).json({
    status: degraded ? "degraded" : "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    dependencies: { database, redis: redisStatus }
  });
});
