import { getRedisClient } from "./redis.js";
import { env } from "../config/env.js";
import { platformMetrics } from "../services/platform-metrics.service.js";
import { AppError } from "../utils/AppError.js";

const memoryReplay = new Map<string, number>();

const pruneMemoryReplay = (now: number) => {
  for (const [key, expiresAt] of memoryReplay.entries()) {
    if (expiresAt <= now) {
      memoryReplay.delete(key);
    }
  }
};

/**
 * Replay protection for edge ingest.
 * Prefers Redis so multi-instance deployments share nonce state.
 * In production, fails closed when Redis is required but unavailable.
 */
export const assertAndStoreEdgeNonce = async (
  deviceId: string,
  nonce: string
): Promise<void> => {
  const ttlSeconds = env.EDGE_INGEST_MAX_SKEW_SECONDS * 2;
  const key = `edge:replay:${deviceId}:${nonce}`;
  const redis =
    env.NODE_ENV === "test" && !env.EDGE_REPLAY_REQUIRE_REDIS
      ? null
      : getRedisClient();

  if (redis) {
    try {
      if (redis.status !== "ready") {
        await Promise.race([
          redis.connect().catch(() => undefined),
          new Promise((resolve) => setTimeout(resolve, 250))
        ]);
      }
      if (redis.status === "ready") {
        platformMetrics.setRedisAvailable(true);
        const result = await redis.set(key, "1", "EX", ttlSeconds, "NX");
        if (result !== "OK") {
          platformMetrics.recordReplayAttempt();
          throw new AppError("Replay request detected for edge ingestion.", 409);
        }
        return;
      }
      platformMetrics.setRedisAvailable(false);
      if (env.EDGE_REPLAY_REQUIRE_REDIS || env.NODE_ENV === "production") {
        throw new AppError("Replay protection unavailable. Edge ingest temporarily rejected.", 503);
      }
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      platformMetrics.setRedisAvailable(false);
      if (env.EDGE_REPLAY_REQUIRE_REDIS || env.NODE_ENV === "production") {
        throw new AppError("Replay protection unavailable. Edge ingest temporarily rejected.", 503);
      }
      // Fall through to memory in non-production when Redis is optional.
    }
  } else if (env.EDGE_REPLAY_REQUIRE_REDIS || (env.NODE_ENV === "production" && !env.EDGE_ALLOW_MEMORY_REPLAY)) {
    platformMetrics.setRedisAvailable(false);
    throw new AppError("Replay protection unavailable. Configure REDIS_URL for edge ingest.", 503);
  }

  const now = Date.now();
  pruneMemoryReplay(now);
  if (memoryReplay.has(key)) {
    platformMetrics.recordReplayAttempt();
    throw new AppError("Replay request detected for edge ingestion.", 409);
  }
  memoryReplay.set(key, now + ttlSeconds * 1000);
};

export const clearEdgeReplayCache = async (): Promise<void> => {
  memoryReplay.clear();
  if (env.NODE_ENV === "test" && !env.EDGE_REPLAY_REQUIRE_REDIS) {
    return;
  }
  const redis = getRedisClient();
  if (!redis) return;
  try {
    if (redis.status !== "ready") {
      await Promise.race([
        redis.connect().catch(() => undefined),
        new Promise((resolve) => setTimeout(resolve, 250))
      ]);
    }
    if (redis.status !== "ready") return;
    const keys = await redis.keys("edge:replay:*");
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch {
    // Best-effort cleanup for tests.
  }
};
