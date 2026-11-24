import type { Request, Response } from "express";

import { env } from "../config/env.js";
import { getRedisClient } from "../lib/redis.js";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";

type DependencyStatus = {
  database: "up" | "down";
  redis: "up" | "down" | "disabled";
};

type ReleaseIdentity = {
  gitSha: string | null;
  imageDigest: string | null;
};

type HealthResponse = {
  status: "ok" | "degraded";
  uptime: number;
  timestamp: string;
  release: ReleaseIdentity;
  dependencies: DependencyStatus;
  safety?: {
    operatingMode: string;
    pilotLockPhysicalExecution: boolean;
    physicalCommandExecutionEnabled: boolean;
    hilPlantApprovalConfirmed: boolean;
  };
  releaseIdentityRequired?: boolean;
  releaseIdentityValid?: boolean;
};

const releaseIdentity = (): ReleaseIdentity => ({
  gitSha: env.RELEASE_GIT_SHA?.trim() || null,
  imageDigest: env.RELEASE_IMAGE_DIGEST?.trim() || null
});

const releaseIdentityRequired = (): boolean => {
  if (env.NODE_ENV === "test") return false;
  if (typeof env.REQUIRE_RELEASE_IDENTITY === "boolean") return env.REQUIRE_RELEASE_IDENTITY;
  return env.NODE_ENV === "production";
};

const releaseIdentityValid = (release: ReleaseIdentity): boolean =>
  /^[a-f0-9]{7,64}$/i.test(release.gitSha ?? "") &&
  /^sha256:[a-f0-9]{64}$/i.test(release.imageDigest ?? "");

export const getLiveness = asyncHandler(async (
  _req: Request<Record<string, never>, Omit<HealthResponse, "dependencies">>,
  res: Response<Omit<HealthResponse, "dependencies">>
) => {
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    release: releaseIdentity()
  });
});

export const getHealth = asyncHandler(async (
  _req: Request<Record<string, never>, HealthResponse>,
  res: Response<HealthResponse>
) => {
  let databaseStatus: DependencyStatus["database"] = "down";
  try {
    await prisma.$queryRaw`SELECT 1`;
    databaseStatus = "up";
  } catch {
    databaseStatus = "down";
  }

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

  const release = releaseIdentity();
  const required = releaseIdentityRequired();
  const valid = releaseIdentityValid(release);
  const identityOk = !required || valid;
  const redisRequired = env.NODE_ENV === "production" || env.EDGE_REPLAY_REQUIRE_REDIS;
  const depsOk = databaseStatus === "up" && (!redisRequired || redisStatus === "up");

  const payload: HealthResponse = {
    status: depsOk && identityOk ? "ok" : "degraded",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    release,
    dependencies: {
      database: databaseStatus,
      redis: redisStatus
    },
    releaseIdentityRequired: required,
    releaseIdentityValid: valid,
    safety: {
      operatingMode: env.GRIDFLEX_OPERATING_MODE,
      pilotLockPhysicalExecution: env.PILOT_LOCK_PHYSICAL_EXECUTION,
      physicalCommandExecutionEnabled: env.PHYSICAL_COMMAND_EXECUTION_ENABLED,
      hilPlantApprovalConfirmed: env.HIL_PLANT_APPROVAL_CONFIRMED
    }
  };

  // Fail closed when DB is unreachable or production requires digest-pinned identity.
  res.status(depsOk && identityOk ? 200 : 503).json(payload);
});
