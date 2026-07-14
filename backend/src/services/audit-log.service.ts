import { Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma.js";

type RecordAuditLogInput = {
  action: string;
  entityType: string;
  entityId?: string | undefined;
  message?: string | undefined;
  metadata?: unknown;
  userId?: string | undefined;
};

export const recordAuditLog = async (input: RecordAuditLogInput): Promise<void> => {
  const data: Prisma.AuditLogUncheckedCreateInput = {
    action: input.action,
    entityType: input.entityType
  };

  if (typeof input.entityId === "string") data.entityId = input.entityId;
  if (typeof input.message === "string") data.message = input.message;
  if (typeof input.userId === "string") data.userId = input.userId;
  if (input.metadata !== undefined) data.metadata = input.metadata as Prisma.InputJsonValue;

  await prisma.auditLog.create({ data });
};

