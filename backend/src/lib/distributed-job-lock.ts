import { randomUUID } from "node:crypto";

import { logger } from "../utils/logger.js";
import { getRedisClient } from "./redis.js";

const DEFAULT_LOCK_TTL_SECONDS = 300;

export type DistributedLockResult = { acquired: boolean; lockKey: string; token?: string };

export const acquireDistributedJobLock = async (
  lockName: string,
  ttlSeconds = DEFAULT_LOCK_TTL_SECONDS
): Promise<DistributedLockResult> => {
  const lockKey = `gridflex:job-lock:${lockName}`;
  const redis = getRedisClient();
  if (!redis) {
    logger.info("Distributed job lock skipped: REDIS_URL not configured.", { lockName });
    return { acquired: true, lockKey };
  }

  const token = randomUUID();
  try {
    if (redis.status !== "ready") await redis.connect();
    const result = await redis.set(lockKey, token, "EX", ttlSeconds, "NX");
    const acquired = result === "OK";
    const lock: DistributedLockResult = { acquired, lockKey };
    if (acquired) lock.token = token;
    return lock;
  } catch (error: unknown) {
    logger.warn("Distributed job lock acquisition failed; proceeding without lock.", {
      lockName,
      message: error instanceof Error ? error.message : "Unknown lock error"
    });
    return { acquired: true, lockKey };
  }
};

export const releaseDistributedJobLock = async (lockKey: string, token?: string): Promise<void> => {
  const redis = getRedisClient();
  if (!redis || !token) return;
  const releaseScript = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;
  try {
    if (redis.status !== "ready") await redis.connect();
    await redis.eval(releaseScript, 1, lockKey, token);
  } catch (error: unknown) {
    logger.warn("Distributed job lock release failed.", {
      lockKey,
      message: error instanceof Error ? error.message : "Unknown unlock error"
    });
  }
};

export const withDistributedJobLock = async <T>(
  lockName: string,
  work: () => Promise<T>,
  ttlSeconds = DEFAULT_LOCK_TTL_SECONDS
): Promise<T | null> => {
  const lock = await acquireDistributedJobLock(lockName, ttlSeconds);
  if (!lock.acquired) {
    logger.info("Distributed job lock held by another instance; skipping run.", { lockName });
    return null;
  }
  try {
    return await work();
  } finally {
    await releaseDistributedJobLock(lock.lockKey, lock.token);
  }
};
