import { createHash } from "node:crypto";

import { Role } from "@prisma/client";

import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { recordAuditLog } from "./audit-log.service.js";
import { AppError } from "../utils/AppError.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken, type JwtPayload } from "../utils/jwt.js";
import { comparePassword, hashPassword } from "../utils/password.js";
import { durationToMs } from "../utils/time.js";

type RegisterInput = {
  email: string;
  password: string;
  name: string;
};

type LoginInput = {
  email: string;
  password: string;
};

const REFRESH_TOKEN_TTL_MS = durationToMs(env.JWT_REFRESH_EXPIRES_IN);

const hashToken = (value: string): string => {
  return createHash("sha256").update(value).digest("hex");
};

const toSafeUser = (user: { id: string; email: string; name: string; role: Role; createdAt: Date; lastLoginAt: Date | null }) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
  lastLoginAt: user.lastLoginAt,
  createdAt: user.createdAt
});

const buildJwtPayload = (user: { id: string; email: string; name: string; role: Role }): JwtPayload => ({
  sub: user.id,
  email: user.email,
  name: user.name,
  role: user.role
});

const issueTokenPair = async (user: { id: string; email: string; name: string; role: Role }) => {
  const payload = buildJwtPayload(user);
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS)
    }
  });

  return {
    accessToken,
    refreshToken
  };
};

export const registerUser = async ({ email, password, name }: RegisterInput) => {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError("An account with this email already exists.", 409);
  }

  const hashedPassword = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name,
      role: Role.operator
    }
  });

  const { accessToken, refreshToken } = await issueTokenPair(user);

  await recordAuditLog({
    action: "auth.register",
    entityType: "User",
    entityId: user.id,
    message: `User registered: ${user.email}`,
    userId: user.id
  });

  return {
    user: toSafeUser(user),
    token: accessToken,
    refreshToken
  };
};

export const loginUser = async ({ email, password }: LoginInput) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AppError("Invalid email or password.", 401);
  }

  const isPasswordValid = await comparePassword(password, user.password);
  if (!isPasswordValid) {
    throw new AppError("Invalid email or password.", 401);
  }

  const { accessToken, refreshToken } = await issueTokenPair(user);

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      lastLoginAt: new Date()
    }
  });

  await recordAuditLog({
    action: "auth.login",
    entityType: "User",
    entityId: user.id,
    message: `User login: ${user.email}`,
    userId: user.id
  });

  return {
    user: toSafeUser(updatedUser),
    token: accessToken,
    refreshToken
  };
};

export const rotateRefreshToken = async (refreshToken: string) => {
  const payload = verifyRefreshToken(refreshToken);
  const storedToken = await prisma.refreshToken.findUnique({
    where: {
      tokenHash: hashToken(refreshToken)
    },
    include: {
      user: true
    }
  });

  if (!storedToken) {
    throw new AppError("Refresh token is invalid.", 401);
  }
  if (storedToken.revokedAt) {
    throw new AppError("Refresh token has been revoked.", 401);
  }
  if (storedToken.expiresAt.getTime() <= Date.now()) {
    throw new AppError("Refresh token expired.", 401);
  }
  if (storedToken.user.id !== payload.sub) {
    throw new AppError("Refresh token subject mismatch.", 401);
  }

  const nextTokens = await issueTokenPair(storedToken.user);

  await prisma.refreshToken.update({
    where: { id: storedToken.id },
    data: { revokedAt: new Date() }
  });

  await recordAuditLog({
    action: "auth.refresh",
    entityType: "User",
    entityId: storedToken.user.id,
    message: `Token refreshed for ${storedToken.user.email}`,
    userId: storedToken.user.id
  });

  return {
    user: toSafeUser(storedToken.user),
    token: nextTokens.accessToken,
    refreshToken: nextTokens.refreshToken
  };
};

export const revokeRefreshToken = async (refreshToken: string) => {
  const tokenHash = hashToken(refreshToken);
  const result = await prisma.refreshToken.updateMany({
    where: {
      tokenHash,
      revokedAt: null
    },
    data: {
      revokedAt: new Date()
    }
  });

  if (result.count > 0) {
    await recordAuditLog({
      action: "auth.logout",
      entityType: "RefreshToken",
      message: "Refresh token revoked."
    });
  }
};
