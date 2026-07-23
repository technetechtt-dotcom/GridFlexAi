import type { RequestHandler } from "express";

import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const allowedOrigins = (): Set<string> =>
  new Set(
    env.CORS_ORIGIN.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
  );

/**
 * CSRF defense for cookie-authenticated mutating requests.
 * Requires Origin (or Referer) to match an allowed CORS origin when a Cookie
 * header is present. Bearer-token-only clients without cookies are unaffected.
 */
export const csrfCookieProtection: RequestHandler = (req, _res, next) => {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) {
    next();
    return;
  }

  const origins = allowedOrigins();
  if (origins.size === 0) {
    next(new AppError("CORS_ORIGIN must be configured for cookie-authenticated writes.", 500));
    return;
  }

  const originHeader = req.headers.origin?.trim();
  if (originHeader && origins.has(originHeader)) {
    next();
    return;
  }

  const referer = req.headers.referer?.trim();
  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin;
      if (origins.has(refererOrigin)) {
        next();
        return;
      }
    } catch {
      // fall through
    }
  }

  next(new AppError("CSRF validation failed for cookie-authenticated request.", 403));
};
