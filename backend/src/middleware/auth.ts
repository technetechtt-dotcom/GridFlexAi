import type { NextFunction, Request, Response } from "express";
import { BlockList, isIP } from "node:net";
import type { Role } from "@prisma/client";

import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";
import { verifyAccessToken } from "../utils/jwt.js";

const normalizeIp = (value: string): string => {
  const raw = value.trim();
  if (!raw) {
    return "";
  }
  if (raw.startsWith("::ffff:")) {
    return raw.slice(7);
  }
  if (raw === "::1") {
    return "127.0.0.1";
  }
  return raw;
};

const buildAdminIpRules = (value: string) => {
  const exactMatches = new Set<string>();
  const cidrMatches = new BlockList();

  const entries = value
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  for (const entry of entries) {
    if (!entry.includes("/")) {
      exactMatches.add(normalizeIp(entry).toLowerCase());
      continue;
    }

    const [rawIp, rawPrefix] = entry.split("/");
    const normalizedIp = normalizeIp(rawIp ?? "").toLowerCase();
    const ipVersion = isIP(normalizedIp);
    const prefix = Number.parseInt(rawPrefix ?? "", 10);

    if (!ipVersion || Number.isNaN(prefix)) {
      continue;
    }

    cidrMatches.addSubnet(normalizedIp, prefix, ipVersion === 4 ? "ipv4" : "ipv6");
  }

  return {
    exactMatches,
    cidrMatches,
    hasRules: exactMatches.size > 0 || entries.some((entry) => entry.includes("/"))
  };
};

const ADMIN_ALLOWED_IP_RULES = buildAdminIpRules(env.ADMIN_ALLOWED_IPS);
const ADMIN_ALLOWED_EMAILS = new Set(
  env.ADMIN_ALLOWED_EMAILS
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
);

const requestIsSecure = (req: Request): boolean => {
  const forwardedProto = req.header("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  return req.secure || forwardedProto === "https";
};

const getClientIp = (req: Request): string => {
  const forwarded = req.header("x-forwarded-for")?.split(",")[0] ?? req.ip ?? "";
  return normalizeIp(forwarded).toLowerCase();
};

const isIpAllowedForAdmin = (ipAddress: string): boolean => {
  if (!ADMIN_ALLOWED_IP_RULES.hasRules) {
    return true;
  }

  if (ADMIN_ALLOWED_IP_RULES.exactMatches.has(ipAddress)) {
    return true;
  }

  const ipVersion = isIP(ipAddress);
  if (!ipVersion) {
    return false;
  }

  return ADMIN_ALLOWED_IP_RULES.cidrMatches.check(ipAddress, ipVersion === 4 ? "ipv4" : "ipv6");
};

export const authenticate = (req: Request, _res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    next(new AppError("Missing or invalid authorization header.", 401));
    return;
  }

  const token = authHeader.slice("Bearer ".length).trim();

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      role: payload.role,
      tokenIssuedAt: typeof payload.iat === "number" ? payload.iat : Math.floor(Date.now() / 1000)
    };
    next();
  } catch {
    next(new AppError("Invalid or expired token.", 401));
  }
};

export const authorizeRoles =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const userRole = req.user?.role as Role | undefined;
    if (!userRole || (roles.length > 0 && !roles.includes(userRole))) {
      next(new AppError("Admin access required.", 403));
      return;
    }

    if (env.ADMIN_REQUIRE_HTTPS && !requestIsSecure(req)) {
      next(new AppError("Admin access requires HTTPS.", 403));
      return;
    }

    const requestIp = getClientIp(req);
    if (!isIpAllowedForAdmin(requestIp)) {
      next(new AppError("Admin access denied for this IP address.", 403));
      return;
    }

    const userEmail = req.user?.email?.trim().toLowerCase() ?? "";
    if (ADMIN_ALLOWED_EMAILS.size > 0 && !ADMIN_ALLOWED_EMAILS.has(userEmail)) {
      next(new AppError("Admin access denied for this account.", 403));
      return;
    }

    const issuedAt = req.user?.tokenIssuedAt ?? 0;
    const maxAgeSeconds = env.ADMIN_MAX_TOKEN_AGE_MINUTES * 60;
    const ageSeconds = Math.floor(Date.now() / 1000) - issuedAt;
    if (ageSeconds > maxAgeSeconds) {
      next(new AppError("Admin token is too old. Please log in again.", 401));
      return;
    }

    next();
  };
