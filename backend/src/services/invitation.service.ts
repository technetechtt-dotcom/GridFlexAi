import { createHash, randomBytes } from "node:crypto";

import type { Role } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/AppError.js";
import { recordAuditLog } from "./audit-log.service.js";

export type InvitationActor = { id: string; name: string; role: string };

const hashInviteToken = (token: string) => createHash("sha256").update(token).digest("hex");

const toDto = (row: {
  id: string;
  email: string;
  role: Role;
  organisationId: string | null;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  invitedBy?: { name: string; email: string } | null;
}) => ({
  id: row.id,
  email: row.email,
  role: row.role,
  organisationId: row.organisationId,
  expiresAt: row.expiresAt.toISOString(),
  acceptedAt: row.acceptedAt?.toISOString() ?? null,
  revokedAt: row.revokedAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
  invitedByName: row.invitedBy?.name ?? null,
  status: row.revokedAt
    ? "revoked"
    : row.acceptedAt
      ? "accepted"
      : row.expiresAt.getTime() <= Date.now()
        ? "expired"
        : "pending"
});

export const listInvitations = async () => {
  const rows = await prisma.userInvitation.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { invitedBy: { select: { name: true, email: true } } }
  });
  return rows.map(toDto);
};

export const createInvitation = async (
  input: { email: string; role?: Role; organisationId?: string; expiresInHours?: number },
  actor: InvitationActor
) => {
  const rawToken = randomBytes(24).toString("hex");
  const tokenHash = hashInviteToken(rawToken);
  const hours = input.expiresInHours ?? 72;
  const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);

  const createData: {
    email: string;
    role: Role;
    tokenHash: string;
    invitedById: string;
    expiresAt: Date;
    organisationId?: string;
  } = {
    email: input.email.trim().toLowerCase(),
    role: input.role ?? "operator",
    tokenHash,
    invitedById: actor.id,
    expiresAt
  };
  if (input.organisationId) createData.organisationId = input.organisationId;

  const row = await prisma.userInvitation.create({
    data: createData,
    include: { invitedBy: { select: { name: true, email: true } } }
  });

  await recordAuditLog({
    action: "invitation.create",
    entityType: "UserInvitation",
    entityId: row.id,
    message: `Invited ${row.email} as ${row.role}`,
    userId: actor.id,
    organisationId: input.organisationId
  });

  return { invitation: toDto(row), token: rawToken };
};

export const resendInvitation = async (id: string, actor: InvitationActor, expiresInHours = 72) => {
  const current = await prisma.userInvitation.findUnique({ where: { id } });
  if (!current) throw new AppError("Invitation not found.", 404);
  if (current.acceptedAt) throw new AppError("Invitation already accepted.", 400);
  if (current.revokedAt) throw new AppError("Invitation was revoked.", 400);

  const rawToken = randomBytes(24).toString("hex");
  const tokenHash = hashInviteToken(rawToken);
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

  const row = await prisma.userInvitation.update({
    where: { id },
    data: { tokenHash, expiresAt, invitedById: actor.id },
    include: { invitedBy: { select: { name: true, email: true } } }
  });

  await recordAuditLog({
    action: "invitation.resend",
    entityType: "UserInvitation",
    entityId: row.id,
    message: `Resent invitation to ${row.email}`,
    userId: actor.id,
    organisationId: row.organisationId ?? undefined
  });

  return { invitation: toDto(row), token: rawToken };
};

export const revokeInvitation = async (id: string, actor: InvitationActor) => {
  const current = await prisma.userInvitation.findUnique({ where: { id } });
  if (!current) throw new AppError("Invitation not found.", 404);

  const row = await prisma.userInvitation.update({
    where: { id },
    data: { revokedAt: new Date() },
    include: { invitedBy: { select: { name: true, email: true } } }
  });

  await recordAuditLog({
    action: "invitation.revoke",
    entityType: "UserInvitation",
    entityId: row.id,
    message: `Revoked invitation for ${row.email}`,
    userId: actor.id,
    organisationId: row.organisationId ?? undefined
  });

  return toDto(row);
};

export const setUserSuspension = async (
  userId: string,
  suspended: boolean,
  actor: InvitationActor
) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError("User not found.", 404);

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { status: suspended ? "suspended" : "active" }
  });

  if (suspended) {
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() }
    });
  }

  await recordAuditLog({
    action: suspended ? "user.suspend" : "user.unsuspend",
    entityType: "User",
    entityId: userId,
    message: `${suspended ? "Suspended" : "Reactivated"} ${user.email}`,
    userId: actor.id
  });

  return {
    id: updated.id,
    email: updated.email,
    name: updated.name,
    status: updated.status
  };
};

export const forcePasswordReset = async (userId: string, actor: InvitationActor) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError("User not found.", 404);

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { mustResetPassword: true }
  });

  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() }
  });

  await recordAuditLog({
    action: "user.force_password_reset",
    entityType: "User",
    entityId: userId,
    message: `Forced password reset for ${user.email}`,
    userId: actor.id
  });

  return {
    id: updated.id,
    email: updated.email,
    mustResetPassword: updated.mustResetPassword
  };
};
