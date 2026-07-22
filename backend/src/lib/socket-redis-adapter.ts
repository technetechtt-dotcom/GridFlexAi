import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import type { Server as SocketIOServer } from "socket.io";

import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

let pubClient: Redis | null = null;
let subClient: Redis | null = null;

export const attachRedisSocketAdapter = async (io: SocketIOServer): Promise<boolean> => {
  if (!env.REDIS_URL?.trim()) {
    logger.info("Socket.IO Redis adapter skipped: REDIS_URL not set.");
    return false;
  }

  try {
    pubClient = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      lazyConnect: true,
      connectTimeout: 2_000
    });
    subClient = pubClient.duplicate();

    await Promise.all([pubClient.connect(), subClient.connect()]);

    io.adapter(createAdapter(pubClient, subClient));
    logger.info("Socket.IO Redis adapter attached.");
    return true;
  } catch (error) {
    logger.warn("Socket.IO Redis adapter unavailable; continuing with in-memory adapter.", {
      event: "socket.redis_adapter_unavailable",
      error: error instanceof Error ? error.message : String(error)
    });
    await closeRedisSocketAdapter();
    return false;
  }
};

export const closeRedisSocketAdapter = async (): Promise<void> => {
  const clients = [subClient, pubClient];
  for (const client of clients) {
    if (!client) continue;
    await client.quit().catch(async () => {
      client.disconnect();
    });
  }
  subClient = null;
  pubClient = null;
};
