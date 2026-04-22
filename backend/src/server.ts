import fs from "node:fs";
import http from "node:http";
import https from "node:https";

import { Server as SocketIOServer } from "socket.io";

import { LIVE_READING_EVENT } from "./config/constants.js";
import { env } from "./config/env.js";
import { createApp } from "./app.js";
import { setSocketServer } from "./config/socket.js";
import { prisma } from "./lib/prisma.js";
import { closeRedisClient } from "./lib/redis.js";
import { startForecastCron } from "./services/forecast-cron.service.js";
import { platformMetrics } from "./services/platform-metrics.service.js";
import { logger } from "./utils/logger.js";

const app = createApp();
const resolveWebServer = () => {
  if (!env.HTTPS_ENABLED) {
    return {
      server: http.createServer(app),
      protocol: "http" as const,
      port: env.PORT
    };
  }

  if (env.HTTPS_PFX_PATH) {
    return {
      server: https.createServer(
        {
          pfx: fs.readFileSync(env.HTTPS_PFX_PATH),
          passphrase: env.HTTPS_PFX_PASSPHRASE
        },
        app
      ),
      protocol: "https" as const,
      port: env.HTTPS_PORT
    };
  }

  if (!env.HTTPS_CERT_PATH || !env.HTTPS_KEY_PATH) {
    throw new Error(
      "HTTPS is enabled but HTTPS_PFX_PATH or HTTPS_CERT_PATH/HTTPS_KEY_PATH are not configured."
    );
  }

  return {
    server: https.createServer(
      {
        cert: fs.readFileSync(env.HTTPS_CERT_PATH),
        key: fs.readFileSync(env.HTTPS_KEY_PATH)
      },
      app
    ),
    protocol: "https" as const,
    port: env.HTTPS_PORT
  };
};

const webServer = resolveWebServer();
let forecastCronTask: ReturnType<typeof startForecastCron> = null;

const io = new SocketIOServer(webServer.server, {
  cors: {
    origin: env.CORS_ORIGIN,
    credentials: true
  }
});

setSocketServer(io);

io.on("connection", (socket) => {
  platformMetrics.incrementSocketConnections();

  // Keep the socket API self-documenting for frontend consumers.
  socket.emit("connected", {
    message: "Connected to GridFlex real-time gateway.",
    liveEvent: LIVE_READING_EVENT
  });

  socket.on("disconnect", () => {
    platformMetrics.decrementSocketConnections();
  });
});

const start = async (): Promise<void> => {
  await prisma.$connect();
  forecastCronTask = startForecastCron();

  webServer.server.listen(webServer.port, "0.0.0.0", () => {
    logger.info(`GridFlex backend listening on ${webServer.protocol}://0.0.0.0:${webServer.port}`);
  });
};

void start();

const shutdown = async () => {
  forecastCronTask?.stop();
  await closeRedisClient();
  await prisma.$disconnect();
  webServer.server.close(() => process.exit(0));
};

process.on("SIGINT", () => {
  void shutdown();
});
process.on("SIGTERM", () => {
  void shutdown();
});
