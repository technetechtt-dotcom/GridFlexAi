import type { NextFunction, Request, Response } from "express";

import { platformMetrics } from "../services/platform-metrics.service.js";

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const end = process.hrtime.bigint();
    const diffMs = Number(end - start) / 1_000_000;
    const path = req.baseUrl ? `${req.baseUrl}${req.path}` : req.path;

    platformMetrics.recordRequest(req.method, path, res.statusCode, diffMs);
  });

  next();
};

