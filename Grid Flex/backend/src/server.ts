// ─── Process-level error handlers ────────────────────────────────────────────
// Registered FIRST — before any import that might throw synchronously — so that
// crashes during module evaluation (e.g. env validation) are always captured.
process.on("uncaughtException", (err) => {
  process.stderr.write(
    JSON.stringify({
      level: "error",
      message: "Uncaught exception — process will exit",
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      timestamp: new Date().toISOString()
    }) + "\n"
  );
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  process.stderr.write(
    JSON.stringify({
      level: "error",
      message: "Unhandled promise rejection — process will exit",
      error: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
      timestamp: new Date().toISOString()
    }) + "\n"
  );
  process.exit(1);
});

// ─── Remaining imports ────────────────────────────────────────────────────────
import fs from "node:fs";
import http from "node:http";
import https from "node:https";

import { Server as SocketIOServer } from "socket.io";

import { LIVE_READING_EVENT } from "./config/constants.js";
import { createApp } from "./app.js";
import { setSocketServer } from "./config/socket.js";
import { prisma } from "./lib/prisma.js";
import { closeRedisClient } from "./lib/redis.js";
import { startForecastCron } from "./services/forecast-cron.service.js";
import { platformMetrics } from "./services/platform-metrics.service.js";
import { logger } from "./utils/logger.js";

// ─── Env validation (wrapped so the error is always visible) ──────────────────
// `env.ts` throws synchronously when validation fails. Wrapping the dynamic
// import in a try/catch guarantees the message reaches stderr even if the
// uncaughtException handler above fires too late for hoisted static imports.
let env: typeof import("./config/env.js").env;
try {
  ({ env } = await import("./config/env.js"));
} catch (err) {
  process.stderr.write(
    JSON.stringify({
      level: "error",
      message: "Environment validation failed — process will exit",
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      timestamp: new Date().toISOString()
    }) + "\n"
  );
  process.exit(1);
}

// ─── Server bootstrap ─────────────────────────────────────────────────────────
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

  webServer.server.listen(webServer.port, () => {
    logger.info(`GridFlex backend listening on ${webServer.protocol}://localhost:${webServer.port}`);
  });
};

start().catch((err: unknown) => {
  logger.error("Fatal error during startup — process will exit", {
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined
  });
  process.exit(1);
});

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
