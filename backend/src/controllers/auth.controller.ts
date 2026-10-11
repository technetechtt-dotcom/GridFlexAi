import type { Request, Response } from "express";
import { createHash } from "node:crypto";

import { REFRESH_COOKIE_NAME } from "../config/constants.js";
import { env } from "../config/env.js";
import {
  acknowledgeAdminMfaRequirement,
  changePassword,
  listActiveSessions,
  loginUser,
  registerUser,
  requestPasswordReset,
  revokeAllSessions,
  revokeRefreshToken,
  rotateRefreshToken
} from "../services/auth.service.js";
import { recordLoginHistoryEntry } from "../services/operator-decision.service.js";
import type { ChangePasswordBody, ForgotPasswordBody, LoginBody, RegisterBody } from "../schemas/request.schemas.js";
import { AppError } from "../utils/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { durationToMs } from "../utils/time.js";

const useSecureAuthCookies =
  env.NODE_ENV === "production" || env.FORCE_HTTPS || env.HTTPS_ENABLED;

const buildRefreshCookieOptions = () => ({
  httpOnly: true,
  secure: useSecureAuthCookies,
  sameSite: "strict" as const,
  maxAge: durationToMs(env.JWT_REFRESH_EXPIRES_IN),
  path: "/api/auth"
});

const attachRefreshTokenCookie = (res: Response, token: string) => {
  res.cookie(REFRESH_COOKIE_NAME, token, buildRefreshCookieOptions());
};

const clearRefreshTokenCookie = (res: Response) => {
  const options = buildRefreshCookieOptions();
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: options.httpOnly,
    secure: options.secure,
    sameSite: options.sameSite,
    path: options.path
  });
};

const hashToken = (value: string): string => {
  return createHash("sha256").update(value).digest("hex");
};

type AuthSuccessResponse = {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    createdAt: Date;
    lastLoginAt: Date | null;
  };
  token: string;
};

type MessageResponse = {
  message: string;
};

export const register = asyncHandler(async (
  req: Request<Record<string, never>, AuthSuccessResponse, RegisterBody>,
  res: Response<AuthSuccessResponse>
) => {
  const registerInput: {
    email: string;
    password: string;
    name: string;
    inviteToken?: string;
  } = {
    email: req.body.email,
    password: req.body.password,
    name: req.body.name
  };
  if (req.body.inviteToken) registerInput.inviteToken = req.body.inviteToken;
  const result = await registerUser(registerInput);
  attachRefreshTokenCookie(res, result.refreshToken);
  res.status(201).json({
    user: result.user,
    token: result.token
  });
});

export const login = asyncHandler(async (
  req: Request<Record<string, never>, AuthSuccessResponse, LoginBody>,
  res: Response<AuthSuccessResponse>
) => {
  const result = await loginUser(req.body);
  attachRefreshTokenCookie(res, result.refreshToken);
  res.status(200).json({
    user: result.user,
    token: result.token
  });
});

export const refresh = asyncHandler(async (
  req: Request<Record<string, never>, AuthSuccessResponse>,
  res: Response<AuthSuccessResponse>
) => {
  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
  if (!refreshToken) {
    throw new AppError("Missing refresh token cookie.", 401);
  }

  const result = await rotateRefreshToken(refreshToken);
  attachRefreshTokenCookie(res, result.refreshToken);
  res.status(200).json({
    user: result.user,
    token: result.token
  });
});

export const logout = asyncHandler(async (
  req: Request<Record<string, never>, MessageResponse>,
  res: Response<MessageResponse>
) => {
  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
  if (refreshToken) {
    await revokeRefreshToken(refreshToken);
  }

  clearRefreshTokenCookie(res);
  res.status(200).json({
    message: "Logged out successfully."
  });
});

export const changePasswordHandler = asyncHandler(async (
  req: Request<Record<string, never>, MessageResponse, ChangePasswordBody>,
  res: Response<MessageResponse>
) => {
  if (!req.user) throw new AppError("Authentication required.", 401);
  const result = await changePassword(req.user.id, req.body.currentPassword, req.body.newPassword);
  // Issue is intentionally not reattached — client must re-login after password change.
  clearRefreshTokenCookie(res);
  res.status(200).json(result);
});

export const forgotPasswordHandler = asyncHandler(async (
  req: Request<Record<string, never>, MessageResponse, ForgotPasswordBody>,
  res: Response<MessageResponse>
) => {
  const result = await requestPasswordReset(req.body.email);
  res.status(200).json(result);
});

export const listSessionsHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError("Authentication required.", 401);
  const data = await listActiveSessions(req.user.id);
  res.status(200).json({ data });
});

export const revokeSessionsHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError("Authentication required.", 401);
  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
  const keepHash = refreshToken ? hashToken(refreshToken) : undefined;
  const result = await revokeAllSessions(req.user.id, keepHash);
  res.status(200).json({ data: result });
});

export const loginHistoryHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError("Authentication required.", 401);
  const limit = req.query.limit ? Number(req.query.limit) : 50;
  const data = await recordLoginHistoryEntry(req.user.id, limit);
  res.status(200).json({ data });
});

export const acknowledgeMfaHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError("Authentication required.", 401);
  const data = await acknowledgeAdminMfaRequirement(req.user.id, req.user.role);
  res.status(200).json({ data });
});
