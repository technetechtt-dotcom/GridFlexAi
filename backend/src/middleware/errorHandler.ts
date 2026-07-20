import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";
import { logger } from "../utils/logger.js";

export const notFoundHandler = (req: Request, _res: Response, next: NextFunction): void => {
  next(new AppError(`Route ${req.method} ${req.originalUrl} not found.`, 404));
};

export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  void _next;
  const requestId = typeof res.locals.requestId === "string" ? res.locals.requestId : "unknown";

  if (err instanceof ZodError) {
    res.status(400).json({
      message: "Request validation failed.",
      requestId,
      errors: err.flatten()
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      message: err.message,
      requestId
    });
    return;
  }

  const jsonParseError = err as { type?: string; message?: string };
  if (jsonParseError?.type === "entity.parse.failed") {
    res.status(400).json({
      message: "Malformed JSON body.",
      requestId
    });
    return;
  }

  logger.error("Unhandled application error", {
    requestId,
    traceId: typeof res.locals.traceId === "string" ? res.locals.traceId : undefined,
    route: `${req.method} ${req.originalUrl}`,
    event: "http.unhandled_error",
    error: err instanceof Error ? err.message : String(err)
  });

  res.status(500).json({
    message: "Internal server error.",
    requestId,
    ...(typeof res.locals.traceId === "string" ? { traceId: res.locals.traceId } : {})
  });
};
