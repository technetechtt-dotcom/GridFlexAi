import type { Request, Response } from "express";

import { env } from "../config/env.js";
import { getRedisClient } from "../lib/redis.js";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";

type DependencyStatus = {
  database: "up";
  redis: "up" | "down" | "disabled";
};

type HealthResponse = {
  status: "ok";
  uptime: number;
  timestamp: string;
  dependencies: DependencyStatus;
};

export const getLiveness = asyncHandler(async (
  _req: Request<Record<string, never>, Omit<HealthResponse, "dependencies">>,
  res: Response<Omit<HealthResponse, "dependencies">>
) => {
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

export const getHealth = asyncHandler(async (
  _req: Request<Record<string, never>, HealthResponse>,
  res: Response<HealthResponse>
) => {
  await prisma.$queryRaw`SELECT 1`;
  let redisStatus: DependencyStatus["redis"] = "disabled";
  if (env.NODE_ENV !== "test") {
    const redisClient = getRedisClient();
    if (!redisClient) {
      redisStatus = "disabled";
    } else {
      try {
        if (redisClient.status !== "ready") {
          await redisClient.connect();
        }
        await redisClient.ping();
        redisStatus = "up";
      } catch {
        redisStatus = "down";
      }
    }
  }

  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    dependencies: {
      database: "up",
      redis: redisStatus
    }
  });
});
