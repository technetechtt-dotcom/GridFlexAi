import type { Request, Response } from "express";

import { REFRESH_COOKIE_NAME } from "../config/constants.js";
import { env } from "../config/env.js";
import { loginUser, registerUser, revokeRefreshToken, rotateRefreshToken } from "../services/auth.service.js";
import type { LoginBody, RegisterBody } from "../schemas/request.schemas.js";
import { AppError } from "../utils/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { durationToMs } from "../utils/time.js";

const buildRefreshCookieOptions = () => ({
  httpOnly: true,
  secure: env.NODE_ENV === "production" || env.FORCE_HTTPS || env.HTTPS_ENABLED,
  sameSite: "lax" as const,
  maxAge: durationToMs(env.JWT_REFRESH_EXPIRES_IN),
  path: "/api/auth"
});

const attachRefreshTokenCookie = (res: Response, token: string) => {
  res.cookie(REFRESH_COOKIE_NAME, token, buildRefreshCookieOptions());
};

const clearRefreshTokenCookie = (res: Response) => {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === "production" || env.FORCE_HTTPS || env.HTTPS_ENABLED,
    sameSite: "lax",
    path: "/api/auth"
  });
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
  const result = await registerUser(req.body);
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
