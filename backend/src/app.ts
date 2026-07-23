import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import path from "node:path";

import { API_PREFIX } from "./config/constants.js";
import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { metricsMiddleware } from "./middleware/metrics.js";
import { requestIdMiddleware } from "./middleware/requestId.js";
import apiRouter from "./routes/index.js";
import { AppError } from "./utils/AppError.js";
import { logger } from "./utils/logger.js";

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many API requests. Please retry shortly."
  }
});

const edgeIngestLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: env.EDGE_RATE_LIMIT_MAX_PER_MINUTE,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.header("x-gridflex-device-id") ?? req.ip ?? "unknown-ip",
  message: {
    message: "Edge ingestion rate limit exceeded for this minute."
  }
});

const forecastLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: env.FORECAST_RATE_LIMIT_MAX_PER_MINUTE,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Forecast request rate limit exceeded for this minute."
  }
});

export const createApp = () => {
  const app = express();
  const adminWebDir = path.resolve(process.cwd(), "public", "admin");
  morgan.token("request_id", (_req, res) => {
    const raw = res.getHeader("x-request-id");
    return typeof raw === "string" ? raw : "n/a";
  });
  const morganFormat = env.NODE_ENV === "production" ?
    ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" req_id=:request_id' :
    ":method :url :status :response-time ms req_id=:request_id";
  app.set("trust proxy", env.TRUST_PROXY ? 1 : 0);
  // Prisma BIGINT fields serialize as JS bigint — JSON.stringify needs a replacer.
  app.set("json replacer", (_key: string, value: unknown) =>
    typeof value === "bigint" ? value.toString(10) : value
  );

  const corsOrigins = env.CORS_ORIGIN.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use(helmet());
  app.use(
    cors({
      origin: corsOrigins.length <= 1 ? corsOrigins[0] : corsOrigins,
      credentials: true
    })
  );

  app.use(requestIdMiddleware);
  app.use(
    morgan(morganFormat, {
      stream: {
        write: (message) => logger.info(message.trim())
      }
    })
  );

  app.use(metricsMiddleware);

  app.use(cookieParser());
  app.use(
    express.json({
      limit: "1mb",
      verify: (req, _res, buf) => {
        // Preserve exact bytes for GRIDFLEX-V1 body hashing (do not re-serialize JSON).
        (req as { rawBody?: Buffer }).rawBody = Buffer.from(buf);
      }
    })
  );

  if (env.FORCE_HTTPS) {
    app.use((req, res, next) => {
      const forwardedProto = req.header("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
      const secure = req.secure || forwardedProto === "https";

      if (secure) {
        next();
        return;
      }

      if (req.method === "GET" || req.method === "HEAD") {
        const host = req.headers.host;
        if (!host) {
          next(new AppError("HTTPS is required.", 426));
          return;
        }
        res.redirect(308, `https://${host}${req.originalUrl}`);
        return;
      }

      next(new AppError("HTTPS is required.", 426));
    });
  }

  app.get("/", (_req, res) => {
    res.status(200).json({
      service: "gridflex-backend",
      status: "ok",
      health: `${API_PREFIX}/health`
    });
  });

  app.get("/favicon.ico", (_req, res) => {
    res.status(204).end();
  });

  app.use("/admin", express.static(adminWebDir));

  app.use(API_PREFIX, apiLimiter);
  app.use(`${API_PREFIX}/edge-data`, edgeIngestLimiter);
  app.use(`${API_PREFIX}/v2/telemetry`, edgeIngestLimiter);
  app.use(`${API_PREFIX}/forecast`, forecastLimiter);
  app.use(API_PREFIX, apiRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
