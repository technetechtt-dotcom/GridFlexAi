import { NodeStatus } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { recordAuditLog } from "./audit-log.service.js";
import { clearForecastCache, getForecastProvidersStatus } from "./forecast.service.js";
import { platformMetrics } from "./platform-metrics.service.js";
import { AppError } from "../utils/AppError.js";

export const getAdminPlatformOverview = async () => {
  const now = new Date();
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [
    dbOk,
    usersTotal,
    nodesTotal,
    nodesOnline,
    readings24h
  ] = await Promise.all([
    prisma.$queryRaw`SELECT 1`.then(
      () => true,
      () => false
    ),
    prisma.user.count(),
    prisma.edgeNode.count(),
    prisma.edgeNode.count({ where: { status: NodeStatus.online } }),
    prisma.sensorReading.count({
      where: {
        timestamp: {
          gte: since24h
        }
      }
    })
  ]);

  const providers = getForecastProvidersStatus().providers;
  const metrics = platformMetrics.snapshot();

  return {
    generatedAt: now.toISOString(),
    database: {
      healthy: dbOk
    },
    providers: {
      forecastSolar: providers.forecastSolar.state,
      openWeather: providers.openWeather.state,
      openWeatherConfigured: providers.openWeather.configured,
      accuWeather: providers.accuWeather.state,
      accuWeatherConfigured: providers.accuWeather.configured
    },
    overview: {
      usersTotal,
      nodesTotal,
      nodesOnline,
      readings24h
    },
    metrics: {
      totalRequests: metrics.totalRequests,
      totalError4xx: metrics.totalError4xx,
      totalError5xx: metrics.totalError5xx,
      avgLatencyMs: metrics.avgLatencyMs,
      socketConnections: metrics.socketConnections
    }
  };
};

export const getAdminUsers = async () => {
  const users = await prisma.user.findMany({
    orderBy: [{ createdAt: "desc" }],
    include: {
      operatorProvisioning: true,
      managedBy: {
        select: { id: true, name: true, email: true }
      },
      _count: {
        select: {
          operators: true
        }
      }
    }
  });

  return users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    managedById: user.managedById,
    managedBy: user.managedBy
      ? {
          id: user.managedBy.id,
          name: user.managedBy.name,
          email: user.managedBy.email
        }
      : null,
    operatorCount: user._count.operators,
    operatorProvisioning: user.operatorProvisioning
      ? {
          enabled: user.operatorProvisioning.enabled,
          maxOperators: user.operatorProvisioning.maxOperators,
          updatedAt: user.operatorProvisioning.updatedAt.toISOString()
        }
      : null
  }));
};

export const updateAdminUserRole = async (id: string, role: "operator" | "manager" | "admin" | "developer") => {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError("User not found.", 404);
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      role,
      managedById: role === "operator" ? existing.managedById : null
    }
  });

  if (existing.role === "manager" && role !== "manager") {
    await prisma.managerOperatorProvisioning.deleteMany({ where: { managerId: id } });
    await prisma.user.updateMany({
      where: { managedById: id },
      data: { managedById: null }
    });
  }

  await recordAuditLog({
    action: "admin.user.role.update",
    entityType: "User",
    entityId: updated.id,
    message: `Updated user role to ${updated.role}`
  });

  return {
    id: updated.id,
    name: updated.name,
    email: updated.email,
    role: updated.role,
    status: updated.status,
    createdAt: updated.createdAt.toISOString(),
    lastLoginAt: updated.lastLoginAt ? updated.lastLoginAt.toISOString() : null
  };
};

export const getAdminNodesOverview = async () => {
  const nodes = await prisma.edgeNode.findMany({
    orderBy: [{ createdAt: "desc" }],
    include: {
      readings: {
        select: {
          id: true
        }
      },
      _count: {
        select: {
          readings: true
        }
      }
    }
  });

  return nodes.map((node) => ({
    id: node.id,
    name: node.name,
    location: node.location,
    status: node.status,
    isActive: node.isActive,
    lastSeen: node.lastSeen ? node.lastSeen.toISOString() : null,
    readingsCount: node._count.readings
  }));
};

export const getAdminMetrics = async () => {
  return platformMetrics.snapshot();
};

export const getAuditLogs = async (options: { page?: number; pageSize?: number; userId?: string } = {}) => {
  const page = options.page && options.page > 0 ? options.page : 1;
  const pageSize = options.pageSize && options.pageSize > 0 && options.pageSize <= 200 ? options.pageSize : 50;

  const where = options.userId ? { userId: options.userId } : {};

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      take: pageSize,
      skip: (page - 1) * pageSize,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      }
    }),
    prisma.auditLog.count({ where })
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

export const runClearForecastCacheAction = async (userId?: string) => {
  const result = await clearForecastCache();
  const auditPayload: {
    action: string;
    entityType: string;
    message: string;
    metadata: { inMemoryEntriesCleared: number; redisEntriesCleared: number };
    userId?: string;
  } = {
    action: "admin.quickAction.clearForecastCache",
    entityType: "Platform",
    message: "Forecast caches cleared",
    metadata: result
  };
  if (typeof userId === "string") {
    auditPayload.userId = userId;
  }
  await recordAuditLog(auditPayload);

  return {
    action: "clear-forecast-cache",
    executedAt: new Date().toISOString(),
    message: `Cleared ${result.inMemoryEntriesCleared} in-memory and ${result.redisEntriesCleared} Redis forecast cache entr${result.redisEntriesCleared === 1 ? "y" : "ies"}.`
  };
};

export const runTestNotificationAction = async (userId?: string) => {
  const payload = {
    channel: "admin-dashboard",
    status: "simulated",
    generatedAt: new Date().toISOString()
  };

  const auditPayload: {
    action: string;
    entityType: string;
    message: string;
    metadata: {
      channel: string;
      status: string;
      generatedAt: string;
    };
    userId?: string;
  } = {
    action: "admin.quickAction.testNotification",
    entityType: "Platform",
    message: "Test notification executed",
    metadata: payload
  };
  if (typeof userId === "string") {
    auditPayload.userId = userId;
  }
  await recordAuditLog(auditPayload);

  return {
    action: "test-notification",
    executedAt: payload.generatedAt,
    message: "Test notification simulated successfully."
  };
};

