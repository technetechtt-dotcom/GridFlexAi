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
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true }
  });

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
    const auditPayload: {
      action: string;
      entityType: string;
      entityId?: string;
      message: string;
      userId?: string;
    } = {
      action: "auth.logout",
      entityType: "User",
      message: stored?.user ? `User logout: ${stored.user.email}` : "Refresh token revoked."
    };
    if (stored?.userId) {
      auditPayload.entityId = stored.userId;
      auditPayload.userId = stored.userId;
    }
    await recordAuditLog(auditPayload);
  }
};

export const changePassword = async (
  userId: string,
  currentPassword: string,
  newPassword: string
) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError("User not found.", 404);
  }

  const valid = await comparePassword(currentPassword, user.password);
  if (!valid) {
    throw new AppError("Current password is incorrect.", 401);
  }
  if (newPassword.length < 8) {
    throw new AppError("New password must be at least 8 characters.", 400);
  }
  if (currentPassword === newPassword) {
    throw new AppError("New password must differ from the current password.", 400);
  }

  const hashedPassword = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword }
  });

  // Force re-auth on other devices after password change.
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() }
  });

  await recordAuditLog({
    action: "auth.password.change",
    entityType: "User",
    entityId: userId,
    message: `Password changed for ${user.email}`,
    userId
  });

  return { message: "Password updated. Other sessions have been signed out." };
};

export const listActiveSessions = async (userId: string) => {
  const rows = await prisma.refreshToken.findMany({
    where: {
      userId,
      revokedAt: null,
      expiresAt: { gt: new Date() }
    },
    orderBy: [{ createdAt: "desc" }],
    take: 50
  });

  return rows.map((row) => ({
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString()
  }));
};

export const revokeAllSessions = async (userId: string, keepTokenHash?: string) => {
  const where: { userId: string; revokedAt: null; tokenHash?: { not: string } } = {
    userId,
    revokedAt: null
  };
  if (keepTokenHash) {
    where.tokenHash = { not: keepTokenHash };
  }

  const result = await prisma.refreshToken.updateMany({
    where,
    data: { revokedAt: new Date() }
  });

  await recordAuditLog({
    action: "auth.sessions.revoke_all",
    entityType: "User",
    entityId: userId,
    message: `Revoked ${result.count} session(s)`,
    userId,
    metadata: { revokedCount: result.count, keptCurrent: Boolean(keepTokenHash) }
  });

  return { revokedCount: result.count };
};

export const requestPasswordReset = async (email: string) => {
  const user = await prisma.user.findUnique({ where: { email } });
  // Always return the same message to avoid account enumeration.
  const message =
    "If an account exists for that email, an administrator can complete a password reset. Self-serve email delivery is not enabled in this pilot.";

  if (user) {
    await recordAuditLog({
      action: "auth.password.reset_requested",
      entityType: "User",
      entityId: user.id,
      message: `Password reset requested for ${user.email}`,
      userId: user.id
    });
  }

  return { message };
};

export const acknowledgeAdminMfaRequirement = async (userId: string, role: string) => {
  if (role !== Role.admin && role !== Role.developer) {
    throw new AppError("MFA acknowledgement is only required for administrators.", 403);
  }

  await recordAuditLog({
    action: "auth.mfa.acknowledged",
    entityType: "User",
    entityId: userId,
    message: "Administrator acknowledged MFA enrollment requirement before production",
    userId,
    metadata: { mfaEnforced: false, status: "pending_enrollment" }
  });

  return {
    message: "MFA requirement acknowledged. TOTP enrollment will be enforced before production cutover.",
    mfaEnforced: false,
    status: "pending_enrollment" as const
  };
};
