import type { RequestHandler } from "express";

import { env } from "../config/env.js";
import { platformMetrics } from "../services/platform-metrics.service.js";
import { AppError } from "../utils/AppError.js";

/**
 * Prometheus scrape endpoint.
 * Protect with METRICS_SCRAPE_TOKEN (preferred) or disable in public deployments.
 */
export const prometheusMetricsHandler: RequestHandler = (req, res, next) => {
  try {
    const configured = env.METRICS_SCRAPE_TOKEN?.trim();
    if (configured) {
      const provided =
        req.header("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
        req.header("x-metrics-token")?.trim() ||
        "";
      if (provided !== configured) {
        next(new AppError("Unauthorized metrics scrape.", 401));
        return;
      }
    } else if (env.NODE_ENV === "production") {
      next(new AppError("METRICS_SCRAPE_TOKEN must be configured in production.", 503));
      return;
    }

    res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
    res.status(200).send(platformMetrics.toPrometheus());
  } catch (error) {
    next(error);
  }
};
