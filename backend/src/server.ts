// ─── Bootstrap error handlers ────────────────────────────────────────────────
// These MUST be registered before any dynamic imports so that synchronous
// throws during module evaluation (e.g. env validation in config/env.ts) are
// caught and written to stderr. Static `import` statements are hoisted and
// evaluated before any executable code, so we use dynamic import() inside the
// async IIFE below to keep all risky imports inside the try-catch.

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

// ─── Main startup ─────────────────────────────────────────────────────────────
// All imports that may throw during module evaluation (env validation, etc.)
// are loaded via dynamic import() so that any synchronous throw is caught by
// the try-catch below and written to stderr before the process exits.

(async () => {
  try {
    const [
      { default: fs },
      { default: http },
      { default: https },
      { Server: SocketIOServer },
      { LIVE_READING_EVENT },
      { env },
      { createApp },
      { setSocketServer },
      { prisma },
      { closeRedisClient },
      { startForecastCron },
      { startTelemetryRetentionCron },
      { startNodeHealthMonitor, stopNodeHealthMonitor },
      { platformMetrics },
      { logger }
    ] = await Promise.all([
      import("node:fs"),
      import("node:http"),
      import("node:https"),
      import("socket.io"),
      import("./config/constants.js"),
      import("./config/env.js"),
      import("./app.js"),
      import("./config/socket.js"),
      import("./lib/prisma.js"),
      import("./lib/redis.js"),
      import("./services/forecast-cron.service.js"),
      import("./services/telemetry-retention.service.js"),
      import("./services/node-health.service.js"),
      import("./services/platform-metrics.service.js"),
      import("./utils/logger.js")
    ]);

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
    let telemetryRetentionTask: ReturnType<typeof startTelemetryRetentionCron> = null;

    const corsOrigins = env.CORS_ORIGIN.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);

    const io = new SocketIOServer(webServer.server, {
      cors: {
        origin: corsOrigins.length <= 1 ? corsOrigins[0] : corsOrigins,
        credentials: true
      }
    });

    const { attachRedisSocketAdapter, closeRedisSocketAdapter } = await import("./lib/socket-redis-adapter.js");
    await attachRedisSocketAdapter(io);

    setSocketServer(io);

    const { registerScopedSocketConnection } = await import("./lib/socket-rooms.js");
    registerScopedSocketConnection(
      io,
      () => platformMetrics.incrementSocketConnections(),
      () => platformMetrics.decrementSocketConnections(),
      LIVE_READING_EVENT
    );

    const { registerSimulationNamespace } = await import("./simulation/socket-namespace.js");
    const { startSimulationPublisher, stopSimulationPublisher } = await import("./simulation/publisher.js");
    registerSimulationNamespace(io);

    const shutdown = async () => {
      forecastCronTask?.stop();
      telemetryRetentionTask?.stop();
      stopNodeHealthMonitor();
      stopSimulationPublisher();
      await closeRedisSocketAdapter();
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

    await prisma.$connect();
    startSimulationPublisher();
    forecastCronTask = startForecastCron();
    telemetryRetentionTask = startTelemetryRetentionCron();
    if (env.NODE_HEALTH_CRON_ENABLED) {
      startNodeHealthMonitor();
    }

    webServer.server.listen(webServer.port, "0.0.0.0", () => {
      logger.info(`GridFlex backend listening on ${webServer.protocol}://0.0.0.0:${webServer.port}`, {
        event: "server.listening",
        physicalExecutionArmed:
          env.PHYSICAL_COMMAND_EXECUTION_ENABLED && env.HIL_PLANT_APPROVAL_CONFIRMED,
        physicalCommandExecutionEnabled: env.PHYSICAL_COMMAND_EXECUTION_ENABLED,
        hilPlantApprovalConfirmed: env.HIL_PLANT_APPROVAL_CONFIRMED,
        pilotLockPhysicalExecution: env.PILOT_LOCK_PHYSICAL_EXECUTION,
        operatingMode: env.GRIDFLEX_OPERATING_MODE
      });
    });
  } catch (err: unknown) {
    process.stderr.write(
      JSON.stringify({
        level: "error",
        message: "Fatal error during startup — process will exit",
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        timestamp: new Date().toISOString()
      }) + "\n"
    );
    process.exit(1);
  }
})();
