import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import type { Server as SocketIOServer } from "socket.io";

import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

let pubClient: Redis | null = null;
let subClient: Redis | null = null;

export const attachRedisSocketAdapter = async (io: SocketIOServer): Promise<boolean> => {
  if (!env.REDIS_URL) return false;
  pubClient = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  subClient = pubClient.duplicate();
  await Promise.all([
    new Promise<void>((resolve, reject) => { pubClient?.once("ready", resolve); pubClient?.once("error", reject); }),
    new Promise<void>((resolve, reject) => { subClient?.once("ready", resolve); subClient?.once("error", reject); })
  ]);
  io.adapter(createAdapter(pubClient, subClient));
  logger.info("Socket.IO Redis adapter attached.");
  return true;
};

export const closeRedisSocketAdapter = async (): Promise<void> => {
  for (const client of [subClient, pubClient]) {
    if (!client) continue;
    await client.quit().catch(() => client.disconnect());
  }
  subClient = null;
  pubClient = null;
};
