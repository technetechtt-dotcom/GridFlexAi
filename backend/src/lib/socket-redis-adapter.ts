import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import type { Server as SocketIOServer } from "socket.io";

import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

let pubClient: Redis | null = null;
let subClient: Redis | null = null;

export const attachRedisSocketAdapter = async (io: SocketIOServer): Promise<boolean> => {
  if (!env.REDIS_URL) {
    logger.info("Socket.IO Redis adapter skipped: REDIS_URL not set.");
    return false;
  }

  pubClient = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true
  });
  subClient = pubClient.duplicate();

  await new Promise<void>((resolve, reject) => {
    let pending = 2;
    const onReady = () => {
      pending -= 1;
      if (pending === 0) resolve();
    };
    const onError = (error: Error) => reject(error);
    pubClient?.once("ready", onReady);
    subClient?.once("ready", onReady);
    pubClient?.once("error", onError);
    subClient?.once("error", onError);
  });

  io.adapter(createAdapter(pubClient, subClient));
  logger.info("Socket.IO Redis adapter attached.");
  return true;
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
