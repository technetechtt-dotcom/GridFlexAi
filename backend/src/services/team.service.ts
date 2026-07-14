import { Role } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { recordAuditLog } from "./audit-log.service.js";
import { AppError } from "../utils/AppError.js";
import { hashPassword } from "../utils/password.js";

const DEFAULT_MAX_OPERATORS = 2;

export const getManagerTeamOverview = async (managerId: string) => {
  const [manager, provisioning, operators] = await Promise.all([
    prisma.user.findUnique({
      where: { id: managerId },
      select: {
        siteId: true,
        site: {
          select: {
            id: true,
            name: true,
            code: true,
            location: true,
            client: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    }),
    prisma.managerOperatorProvisioning.findUnique({ where: { managerId } }),
    prisma.user.findMany({
      where: { managedById: managerId, role: Role.operator },
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        email: true,
        siteId: true,
        site: {
          select: {
            id: true,
            name: true,
            code: true
          }
        },
        status: true,
        createdAt: true,
        lastLoginAt: true
      }
    })
  ]);

  const enabled = provisioning?.enabled ?? false;
  const maxOperators = provisioning?.maxOperators ?? DEFAULT_MAX_OPERATORS;

  return {
    site: manager?.site
      ? {
          id: manager.site.id,
          name: manager.site.name,
          code: manager.site.code,
          location: manager.site.location,
          client: manager.site.client
        }
      : null,
    provisioning: {
      enabled,
      maxOperators,
      operatorCount: operators.length,
      remainingSlots: enabled ? Math.max(0, maxOperators - operators.length) : 0
    },
    operators: operators.map((operator) => ({
      id: operator.id,
      name: operator.name,
      email: operator.email,
      siteId: operator.siteId,
      site: operator.site,
      status: operator.status,
      createdAt: operator.createdAt.toISOString(),
      lastLoginAt: operator.lastLoginAt ? operator.lastLoginAt.toISOString() : null
    }))
  };
};

export const createManagedOperator = async (
  managerId: string,
  input: { name: string; email: string; password: string }
) => {
  const manager = await prisma.user.findUnique({
    where: { id: managerId },
    include: {
      site: {
        select: {
          id: true,
          name: true,
          code: true
        }
      }
    }
  });
  if (!manager || manager.role !== Role.manager) {
    throw new AppError("Only managers can create operator accounts.", 403);
  }
  if (!manager.siteId) {
    throw new AppError("Ops Center must assign your manager account to a site before you can register operators.", 403);
  }

  const provisioning = await prisma.managerOperatorProvisioning.findUnique({ where: { managerId } });
  if (!provisioning?.enabled) {
    throw new AppError("Operator account creation is not activated for this manager. Contact Ops Center.", 403);
  }

  const operatorCount = await prisma.user.count({
    where: { managedById: managerId, role: Role.operator }
  });
  if (operatorCount >= provisioning.maxOperators) {
    throw new AppError(`Operator limit reached (${provisioning.maxOperators}). Ask Ops Center to raise the quota.`, 403);
  }

  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new AppError("An account with this email already exists.", 409);
  }

  const hashedPassword = await hashPassword(input.password);
  const operator = await prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      password: hashedPassword,
      role: Role.operator,
      managedById: managerId,
      siteId: manager.siteId
    }
  });

  await recordAuditLog({
    action: "manager.operator.create",
    entityType: "User",
    entityId: operator.id,
    message: `Manager ${manager.email} created operator ${operator.email}`,
    userId: managerId,
    metadata: {
      managedById: managerId,
      operatorEmail: operator.email,
      siteId: manager.siteId,
      siteCode: manager.site?.code ?? null
    }
  });

  return {
    id: operator.id,
    name: operator.name,
    email: operator.email,
    siteId: operator.siteId,
    site: manager.site,
    status: operator.status,
    createdAt: operator.createdAt.toISOString(),
    lastLoginAt: operator.lastLoginAt ? operator.lastLoginAt.toISOString() : null
  };
};

export const getManagedOperatorActivity = async (
  managerId: string,
  options: { page?: number; pageSize?: number } = {}
) => {
  const page = options.page && options.page > 0 ? options.page : 1;
  const pageSize = options.pageSize && options.pageSize > 0 && options.pageSize <= 200 ? options.pageSize : 50;

  const operators = await prisma.user.findMany({
    where: { managedById: managerId, role: Role.operator },
    select: { id: true }
  });
  const operatorIds = operators.map((row) => row.id);

  if (operatorIds.length === 0) {
    return { page, pageSize, total: 0, data: [] as Array<{
      id: string;
      action: string;
      entityType: string;
      entityId: string | null;
      message: string | null;
      metadata: unknown;
      userId: string | null;
      userEmail: string | null;
      userName: string | null;
      createdAt: string;
    }> };
  }

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where: { userId: { in: operatorIds } },
      orderBy: [{ createdAt: "desc" }],
      take: pageSize,
      skip: (page - 1) * pageSize,
      include: {
        user: {
          select: { id: true, email: true, name: true }
        }
      }
    }),
    prisma.auditLog.count({ where: { userId: { in: operatorIds } } })
  ]);

  return {
    page,
    pageSize,
    total,
    data: rows.map((row) => ({
      id: row.id,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      message: row.message,
      metadata: row.metadata,
      userId: row.userId,
      userEmail: row.user?.email ?? null,
      userName: row.user?.name ?? null,
      createdAt: row.createdAt.toISOString()
    }))
  };
};

export const setManagerOperatorProvisioning = async (
  managerId: string,
  input: { enabled: boolean; maxOperators?: number },
  updatedById?: string
) => {
  const manager = await prisma.user.findUnique({ where: { id: managerId } });
  if (!manager) {
    throw new AppError("User not found.", 404);
  }
  if (manager.role !== Role.manager) {
    throw new AppError("Operator provisioning can only be configured for manager accounts.", 400);
  }
  if (input.enabled && !manager.siteId) {
    throw new AppError("Assign this manager to a site before enabling operator registration.", 400);
  }

  const maxOperators = Math.max(2, input.maxOperators ?? DEFAULT_MAX_OPERATORS);

  const provisioning = await prisma.managerOperatorProvisioning.upsert({
    where: { managerId },
    create: {
      managerId,
      enabled: input.enabled,
      maxOperators,
      updatedById: updatedById ?? null
    },
    update: {
      enabled: input.enabled,
      maxOperators,
      updatedById: updatedById ?? null
    }
  });

  const auditPayload: {
    action: string;
    entityType: string;
    entityId: string;
    message: string;
    userId?: string;
    metadata: { enabled: boolean; maxOperators: number };
  } = {
    action: "admin.manager.provisioning.update",
    entityType: "User",
    entityId: managerId,
    message: `Operator provisioning ${provisioning.enabled ? "enabled" : "disabled"} for ${manager.email} (max ${provisioning.maxOperators})`,
    metadata: {
      enabled: provisioning.enabled,
      maxOperators: provisioning.maxOperators
    }
  };
  if (updatedById) {
    auditPayload.userId = updatedById;
  }
  await recordAuditLog(auditPayload);

  return {
    managerId: provisioning.managerId,
    enabled: provisioning.enabled,
    maxOperators: provisioning.maxOperators,
    updatedAt: provisioning.updatedAt.toISOString()
  };
};

export const recordUserActivity = async (
  userId: string,
  input: { action: string; message?: string; metadata?: unknown; entityType?: string; entityId?: string }
) => {
  const auditPayload: {
    action: string;
    entityType: string;
    entityId: string;
    message?: string;
    metadata?: unknown;
    userId: string;
  } = {
    action: input.action.startsWith("user.") ? input.action : `user.${input.action}`,
    entityType: input.entityType ?? "UserActivity",
    entityId: input.entityId ?? userId,
    userId
  };
  if (typeof input.message === "string") auditPayload.message = input.message;
  if (input.metadata !== undefined) auditPayload.metadata = input.metadata;
  await recordAuditLog(auditPayload);
};
