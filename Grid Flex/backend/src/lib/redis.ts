import Redis from "ioredis";

import { env } from "../config/env.js";

let redisClient: Redis | null = null;

export const getRedisClient = (): Redis | null => {
  if (!env.REDIS_URL) {
    return null;
  }

  if (!redisClient) {
    redisClient = new Redis(env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false
    });

    redisClient.on("error", () => {
      // Intentionally swallow connection errors to preserve API availability.
    });
  }

  return redisClient;
};

export const closeRedisClient = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit().catch(async () => {
      await redisClient?.disconnect();
    });
    redisClient = null;
  }
};
