import { NodeStatus, Prisma } from "@prisma/client";

import {
  NODE_ALERT_EVENT,
  NODE_COMMAND_EVENT,
  NODE_MAINTENANCE_REQUEST_EVENT,
  NODE_STATUS_UPDATE_EVENT,
  NEW_NODE_EVENT
} from "../config/constants.js";
import { getSocketServer } from "../config/socket.js";
import { prisma } from "../lib/prisma.js";
import type {
  MaintenanceRequestBody,
  NodeBody,
  NodeBulkActionBody,
  NodeQuery,
  NodeUpdateBody
} from "../schemas/request.schemas.js";
import { AppError } from "../utils/AppError.js";
import {
  getOptionalSiteAccessScope,
  resolveScopedSiteId,
  type AccessActor
} from "./access-scope.service.js";
import { recordAuditLog } from "./audit-log.service.js";

const STALE_NODE_MINUTES = 30;
const LOW_BATTERY_THRESHOLD = 20;
const LOW_SIGNAL_THRESHOLD = 30;

const nodeListInclude = Prisma.validator<Prisma.EdgeNodeInclude>()({
  site: {
    select: {
      id: true,
      name: true,
      code: true,
      location: true,
      client: {
        select: {
          id: true,
          name: true,
          slug: true
        }
      }
    }
  },
  readings: {
    orderBy: [{ timestamp: "desc" }],
    take: 1
  },
  _count: {
    select: {
      readings: true,
      maintenanceRequests: true
    }
  }
});

const nodeDetailInclude = Prisma.validator<Prisma.EdgeNodeInclude>()({
  ...nodeListInclude,
  readings: {
    orderBy: [{ timestamp: "desc" }],
    take: 48
  },
  statusLogs: {
    orderBy: [{ createdAt: "desc" }],
    take: 50
  },
  maintenanceRequests: {
    orderBy: [{ createdAt: "desc" }],
    take: 20
  }
});

type NodeListRow = Prisma.EdgeNodeGetPayload<{ include: typeof nodeListInclude }>;
type NodeDetailRow = Prisma.EdgeNodeGetPayload<{ include: typeof nodeDetailInclude }>;

type NodeTelemetryPatch = {
  batteryLevel?: number;
  signalStrength?: number;
  firmwareVersion?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
};

type NodeAlert = {
  id: string;
  type: "offline" | "lowBattery" | "lowSignal" | "stale" | "anomaly";
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
};

const safeEmit = (eventName: string, payload: unknown): void => {
  try {
    getSocketServer().emit(eventName, payload);
  } catch {
    // Unit tests and one-off scripts may use services without a Socket.io server.
  }
};

const clamp = (value: number, min = 0, max = 100): number => Math.max(min, Math.min(max, value));

const normalizeSignalScore = (signalStrength: number | null): number => {
  if (typeof signalStrength !== "number") return 55;
  if (signalStrength < 0) {
    return clamp((signalStrength + 100) * 2);
  }
  return clamp(signalStrength);
};

const minutesSince = (date: Date | null): number | null => {
  if (!date) return null;
  return Math.max(0, (Date.now() - date.getTime()) / 60_000);
};

export const calculateNodeHealthScore = (node: {
  status: NodeStatus;
  batteryLevel: number | null;
  signalStrength: number | null;
  lastSeen: Date | null;
}): number => {
  const batteryScore = typeof node.batteryLevel === "number" ? clamp(node.batteryLevel) : 60;
  const signalScore = normalizeSignalScore(node.signalStrength);
  const ageMinutes = minutesSince(node.lastSeen);
  const recencyScore =
    node.status === NodeStatus.offline ? 0 :
    ageMinutes === null ? 25 :
    ageMinutes <= 5 ? 100 :
    ageMinutes <= STALE_NODE_MINUTES ? 80 :
    ageMinutes <= 24 * 60 ? 35 :
    0;
  const statusScore =
    node.status === NodeStatus.online ? 100 :
    node.status === NodeStatus.maintenance ? 65 :
    0;

  return Math.round(
    batteryScore * 0.3 +
    signalScore * 0.25 +
    recencyScore * 0.25 +
    statusScore * 0.2
  );
};

const buildNodeAlerts = (node: NodeListRow | NodeDetailRow): NodeAlert[] => {
  const alerts: NodeAlert[] = [];
  const latestReading = node.readings[0];
  const ageMinutes = minutesSince(node.lastSeen);

  if (node.status === NodeStatus.offline) {
    alerts.push({
      id: `${node.id}-offline`,
      type: "offline",
      severity: "critical",
      title: "Node offline",
      message: `${node.name} is currently offline.`
    });
  }

  if (node.status === NodeStatus.online && (ageMinutes === null || ageMinutes > STALE_NODE_MINUTES)) {
    alerts.push({
      id: `${node.id}-stale`,
      type: "stale",
      severity: "warning",
      title: "Telemetry stale",
      message: ageMinutes === null
        ? `${node.name} has never reported telemetry.`
        : `${node.name} last reported ${Math.round(ageMinutes)} minutes ago.`
    });
  }

  if (typeof node.batteryLevel === "number" && node.batteryLevel < LOW_BATTERY_THRESHOLD) {
    alerts.push({
      id: `${node.id}-battery`,
      type: "lowBattery",
      severity: node.batteryLevel < 10 ? "critical" : "warning",
      title: "Low battery",
      message: `${node.name} battery is at ${Math.round(node.batteryLevel)}%.`
    });
  }

  if (normalizeSignalScore(node.signalStrength) < LOW_SIGNAL_THRESHOLD) {
    alerts.push({
      id: `${node.id}-signal`,
      type: "lowSignal",
      severity: "warning",
      title: "Weak signal",
      message: `${node.name} signal strength is below the operational threshold.`
    });
  }

  if (typeof latestReading?.curtailment === "number" && latestReading.curtailment >= 5) {
    alerts.push({
      id: `${node.id}-curtailment`,
      type: "anomaly",
      severity: "warning",
      title: "Curtailment anomaly",
      message: `${node.name} reported ${latestReading.curtailment.toFixed(1)} kW curtailment in the latest reading.`
    });
  }

  return alerts;
};

const statusBadgeFor = (node: NodeListRow | NodeDetailRow): "online" | "offline" | "maintenance" | "warning" => {
  if (node.status === NodeStatus.offline) return "offline";
  if (node.status === NodeStatus.maintenance) return "maintenance";
  return buildNodeAlerts(node).some((alert) => alert.severity !== "info") ? "warning" : "online";
};

const serializeReading = (reading: NodeDetailRow["readings"][number] | NodeListRow["readings"][number]) => ({
  id: reading.id,
  nodeId: reading.nodeId,
  voltage: reading.voltage,
  current: reading.current,
  power: reading.power,
  energyToday: reading.energyToday,
  inverterPower: reading.inverterPower,
  curtailment: reading.curtailment,
  timestamp: reading.timestamp.toISOString()
});

type NodeWindowStats = {
  nodeId: string;
  _avg: {
    power: number | null;
    voltage: number | null;
    current: number | null;
  };
  _count: {
    _all: number;
  };
};

const serializeListNode = (
  node: NodeListRow,
  statsByNode: Map<string, NodeWindowStats> = new Map(),
  energyByNode: Map<string, number | null> = new Map()
) => {
  const latestReading = node.readings[0] ?? null;
  const healthScore = calculateNodeHealthScore(node);
  const alerts = buildNodeAlerts(node);
  const stats = statsByNode.get(node.id);
  const avgPower24h = stats?._avg.power;

  return {
    id: node.id,
    deviceKey: node.deviceKey,
    serialNumber: node.serialNumber,
    siteId: node.siteId,
    site: node.site,
    name: node.name,
    location: node.location,
    latitude: node.latitude,
    longitude: node.longitude,
    status: node.status,
    statusBadge: statusBadgeFor(node),
    firmwareVersion: node.firmwareVersion,
    batteryLevel: node.batteryLevel,
    signalStrength: node.signalStrength,
    healthScore,
    alerts,
    installedAt: node.installedAt.toISOString(),
    lastRestartedAt: node.lastRestartedAt?.toISOString() ?? null,
    isActive: node.isActive,
    lastSeen: node.lastSeen?.toISOString() ?? null,
    createdAt: node.createdAt.toISOString(),
    updatedAt: node.updatedAt.toISOString(),
    readingsCount: node._count.readings,
    openMaintenanceRequests: node._count.maintenanceRequests,
    lastReading: latestReading ? serializeReading(latestReading) : null,
    latestReadingSummary: {
      latestTimestamp: latestReading?.timestamp.toISOString() ?? null,
      latestPowerKw: latestReading?.power ?? null,
      latestVoltage: latestReading?.voltage ?? null,
      latestCurrent: latestReading?.current ?? null,
      avgPower24h: typeof avgPower24h === "number" ? Number(avgPower24h.toFixed(2)) : null,
      samples24h: stats?._count._all ?? 0,
      energyTodayKwh: energyByNode.get(node.id) ?? latestReading?.energyToday ?? null
    }
  };
};

const serializeDetailNode = (node: NodeDetailRow) => ({
  ...serializeListNode(node),
  readings: node.readings.map(serializeReading),
  statusLogs: node.statusLogs.map((log) => ({
    id: log.id,
    nodeId: log.nodeId,
    fromStatus: log.fromStatus,
    toStatus: log.toStatus,
    action: log.action,
    message: log.message,
    metadata: log.metadata,
    userId: log.userId,
    createdAt: log.createdAt.toISOString()
  })),
  maintenanceRequests: node.maintenanceRequests.map((request) => ({
    id: request.id,
    nodeId: request.nodeId,
    requestedById: request.requestedById,
    issueType: request.issueType,
    description: request.description,
    status: request.status,
    createdAt: request.createdAt.toISOString(),
    resolvedAt: request.resolvedAt?.toISOString() ?? null
  }))
});

const toStatusUpdatePayload = (node: {
  id: string;
  serialNumber: string | null;
  name: string;
  location: string;
  status: NodeStatus;
  batteryLevel: number | null;
  signalStrength: number | null;
  firmwareVersion: string | null;
  lastSeen: Date | null;
  createdAt: Date;
}) => ({
  id: node.id,
  serialNumber: node.serialNumber,
  name: node.name,
  location: node.location,
  status: node.status,
  batteryLevel: node.batteryLevel,
  signalStrength: node.signalStrength,
  firmwareVersion: node.firmwareVersion,
  lastSeen: node.lastSeen?.toISOString() ?? null,
  createdAt: node.createdAt.toISOString()
});

export const createStatusLog = async (input: {
  nodeId: string;
  fromStatus?: NodeStatus | null;
  toStatus: NodeStatus;
  action: string;
  message?: string | undefined;
  metadata?: Prisma.InputJsonValue;
  userId?: string | undefined;
}) => {
  const data: Prisma.EdgeNodeStatusLogCreateInput = {
    node: {
      connect: {
        id: input.nodeId
      }
    },
    toStatus: input.toStatus,
    action: input.action
  };
  if (input.fromStatus !== undefined) data.fromStatus = input.fromStatus;
  if (input.message !== undefined) data.message = input.message;
  if (input.metadata !== undefined) data.metadata = input.metadata;
  if (input.userId !== undefined) data.userId = input.userId;

  return prisma.edgeNodeStatusLog.create({ data });
};

const buildNodeWhere = (filters: NodeQuery = {}): Prisma.EdgeNodeWhereInput => {
  const where: Prisma.EdgeNodeWhereInput = {};
  if (filters.siteId) {
    where.siteId = filters.siteId;
  }
  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.serialNumber) {
    where.serialNumber = {
      contains: filters.serialNumber,
      mode: "insensitive"
    };
  }
  if (filters.search?.trim()) {
    const search = filters.search.trim();
    where.OR = [
      { id: { contains: search, mode: "insensitive" } },
      { name: { contains: search, mode: "insensitive" } },
      { serialNumber: { contains: search, mode: "insensitive" } },
      { deviceKey: { contains: search, mode: "insensitive" } },
      { location: { contains: search, mode: "insensitive" } },
      {
        site: {
          is: {
            name: {
              contains: search,
              mode: "insensitive"
            }
          }
        }
      },
      {
        site: {
          is: {
            code: {
              contains: search,
              mode: "insensitive"
            }
          }
        }
      }
    ];
  }
  return where;
};

export const listNodesWithLastReading = async (filters: NodeQuery = {}, actor?: AccessActor) => {
  const scopedSiteId = await resolveScopedSiteId(actor, filters.siteId);
  const scopedFilters = {
    ...filters
  };
  if (scopedSiteId) {
    scopedFilters.siteId = scopedSiteId;
  }

  const nodes = await prisma.edgeNode.findMany({
    where: buildNodeWhere(scopedFilters),
    orderBy: [{ createdAt: "desc" }],
    include: nodeListInclude
  });

  if (nodes.length === 0) {
    return [];
  }

  const nodeIds = nodes.map((node) => node.id);
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [windowStats, lastEnergyToday] = await Promise.all([
    prisma.sensorReading.groupBy({
      by: ["nodeId"],
      where: {
        nodeId: {
          in: nodeIds
        },
        timestamp: {
          gte: since24h
        }
      },
      _avg: {
        power: true,
        voltage: true,
        current: true
      },
      _count: {
        _all: true
      }
    }),
    prisma.sensorReading.findMany({
      where: {
        nodeId: {
          in: nodeIds
        },
        timestamp: {
          gte: since24h
        },
        energyToday: {
          not: null
        }
      },
      orderBy: [{ timestamp: "desc" }],
      distinct: ["nodeId"],
      select: {
        nodeId: true,
        energyToday: true
      }
    })
  ]);

  const statsByNode = new Map(windowStats.map((row) => [row.nodeId, row]));
  const energyByNode = new Map(lastEnergyToday.map((row) => [row.nodeId, row.energyToday]));

  return nodes.map((node) => serializeListNode(node, statsByNode, energyByNode));
};

export const getNodeDetail = async (id: string, actor?: AccessActor) => {
  const node = await prisma.edgeNode.findUnique({
    where: { id },
    include: nodeDetailInclude
  });
  if (!node) {
    throw new AppError("Node not found.", 404);
  }

  const scope = await getOptionalSiteAccessScope(actor);
  if (scope.kind === "site" && node.siteId !== scope.siteId) {
    throw new AppError("You can only access nodes for your assigned site/plant.", 403);
  }

  return serializeDetailNode(node);
};

export const createEdgeNode = async (input: NodeBody, userId?: string) => {
  const data: Prisma.EdgeNodeCreateInput = {
    name: input.name,
    serialNumber: input.serialNumber,
    location: input.location,
    status: input.status,
    isActive: input.isActive ?? true
  };
  if (input.siteId) data.site = { connect: { id: input.siteId } };
  if (input.latitude !== undefined) data.latitude = input.latitude;
  if (input.longitude !== undefined) data.longitude = input.longitude;
  if (input.firmwareVersion !== undefined) data.firmwareVersion = input.firmwareVersion;
  if (input.batteryLevel !== undefined) data.batteryLevel = input.batteryLevel;
  if (input.signalStrength !== undefined) data.signalStrength = input.signalStrength;
  if (input.installedAt) data.installedAt = new Date(input.installedAt);
  if (input.deviceKey !== undefined) data.deviceKey = input.deviceKey;

  const created = await prisma.edgeNode.create({
    data,
    include: nodeDetailInclude
  });

  await createStatusLog({
    nodeId: created.id,
    toStatus: created.status,
    action: "node.created",
    message: `Created node ${created.name}`,
    userId
  });
  await recordAuditLog({
    action: "node.create",
    entityType: "EdgeNode",
    entityId: created.id,
    message: `Created node ${created.name}`,
    userId
  });

  const payload = toStatusUpdatePayload(created);
  safeEmit(NEW_NODE_EVENT, payload);
  safeEmit(NODE_STATUS_UPDATE_EVENT, payload);

  return serializeDetailNode(created);
};

export const updateEdgeNode = async (id: string, input: NodeUpdateBody, userId?: string) => {
  const existing = await prisma.edgeNode.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError("Node not found.", 404);
  }

  const data: Prisma.EdgeNodeUpdateInput = {};
  if (typeof input.name === "string") data.name = input.name;
  if (typeof input.serialNumber === "string") data.serialNumber = input.serialNumber;
  if (typeof input.location === "string") data.location = input.location;
  if (input.latitude !== undefined) data.latitude = input.latitude;
  if (input.longitude !== undefined) data.longitude = input.longitude;
  if (input.status !== undefined) data.status = input.status;
  if (input.firmwareVersion !== undefined) data.firmwareVersion = input.firmwareVersion;
  if (input.batteryLevel !== undefined) data.batteryLevel = input.batteryLevel;
  if (input.signalStrength !== undefined) data.signalStrength = input.signalStrength;
  if (typeof input.installedAt === "string") data.installedAt = new Date(input.installedAt);
  if (input.deviceKey !== undefined) data.deviceKey = input.deviceKey;
  if (typeof input.isActive === "boolean") data.isActive = input.isActive;
  if (input.siteId !== undefined) {
    data.site = input.siteId ? { connect: { id: input.siteId } } : { disconnect: true };
  }

  const updated = await prisma.edgeNode.update({
    where: { id },
    data,
    include: nodeDetailInclude
  });

  const statusChanged = input.status !== undefined && existing.status !== input.status;
  await createStatusLog({
    nodeId: updated.id,
    fromStatus: statusChanged ? existing.status : updated.status,
    toStatus: updated.status,
    action: statusChanged ? "node.status.updated" : "node.updated",
    message: statusChanged
      ? `Status changed from ${existing.status} to ${updated.status}`
      : `Updated node ${updated.name}`,
    userId
  });
  await recordAuditLog({
    action: statusChanged ? "node.status.update" : "node.update",
    entityType: "EdgeNode",
    entityId: updated.id,
    message: statusChanged
      ? `Status changed from ${existing.status} to ${updated.status}`
      : `Updated node ${updated.name}`,
    userId
  });

  const payload = toStatusUpdatePayload(updated);
  safeEmit(NODE_STATUS_UPDATE_EVENT, payload);
  for (const alert of buildNodeAlerts(updated)) {
    safeEmit(NODE_ALERT_EVENT, { nodeId: updated.id, alert });
  }

  return serializeDetailNode(updated);
};

export const deleteEdgeNode = async (id: string, userId?: string) => {
  const existing = await prisma.edgeNode.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError("Node not found.", 404);
  }

  await prisma.edgeNode.delete({ where: { id } });
  await recordAuditLog({
    action: "node.delete",
    entityType: "EdgeNode",
    entityId: id,
    message: `Deleted node ${existing.name}`,
    userId
  });

  return {
    id,
    deleted: true
  };
};

export const bulkNodeAction = async (input: NodeBulkActionBody, userId?: string) => {
  const nodes = await prisma.edgeNode.findMany({
    where: {
      id: {
        in: input.nodeIds
      }
    }
  });

  if (nodes.length !== input.nodeIds.length) {
    throw new AppError("One or more nodes were not found.", 404);
  }

  const now = new Date();

  if (input.action === "assignSite") {
    await prisma.edgeNode.updateMany({
      where: { id: { in: input.nodeIds } },
      data: { siteId: input.siteId ?? null }
    });

    await Promise.all(nodes.map((node) =>
      createStatusLog({
        nodeId: node.id,
        fromStatus: node.status,
        toStatus: node.status,
        action: "node.bulk.assignSite",
        message: input.siteId ? `Assigned node to site ${input.siteId}` : "Unassigned node from site",
        metadata: { siteId: input.siteId ?? null },
        userId
      })
    ));
  }

  if (input.action === "updateStatus") {
    const nextStatus = input.status;
    if (!nextStatus) {
      throw new AppError("status is required for updateStatus.", 400);
    }

    await Promise.all(nodes.map(async (node) => {
      const updated = await prisma.edgeNode.update({
        where: { id: node.id },
        data: { status: nextStatus },
        select: {
          id: true,
          serialNumber: true,
          name: true,
          location: true,
          status: true,
          batteryLevel: true,
          signalStrength: true,
          firmwareVersion: true,
          lastSeen: true,
          createdAt: true
        }
      });
      await createStatusLog({
        nodeId: node.id,
        fromStatus: node.status,
        toStatus: updated.status,
        action: "node.bulk.statusUpdate",
        message: `Bulk status update to ${updated.status}`,
        userId
      });
      safeEmit(NODE_STATUS_UPDATE_EVENT, toStatusUpdatePayload(updated));
    }));
  }

  if (input.action === "remoteRestart") {
    await prisma.edgeNode.updateMany({
      where: { id: { in: input.nodeIds } },
      data: { lastRestartedAt: now }
    });
    await Promise.all(nodes.map((node) =>
      createStatusLog({
        nodeId: node.id,
        fromStatus: node.status,
        toStatus: node.status,
        action: "node.remoteRestart",
        message: "Remote restart requested",
        metadata: { requestedAt: now.toISOString() },
        userId
      })
    ));
    safeEmit(NODE_COMMAND_EVENT, {
      command: "remoteRestart",
      nodeIds: input.nodeIds,
      requestedAt: now.toISOString()
    });
  }

  await recordAuditLog({
    action: `node.bulk.${input.action}`,
    entityType: "EdgeNode",
    message: `Bulk node action ${input.action} affected ${nodes.length} node${nodes.length === 1 ? "" : "s"}`,
    metadata: {
      nodeIds: input.nodeIds,
      siteId: input.siteId ?? null,
      status: input.status ?? null
    },
    userId
  });

  return {
    action: input.action,
    affected: nodes.length,
    executedAt: now.toISOString()
  };
};

export const createNodeMaintenanceRequest = async (
  nodeId: string,
  input: MaintenanceRequestBody,
  userId?: string,
  actor?: AccessActor
) => {
  const node = await prisma.edgeNode.findUnique({ where: { id: nodeId } });
  if (!node) {
    throw new AppError("Node not found.", 404);
  }

  const scope = await getOptionalSiteAccessScope(actor);
  if (scope.kind === "site" && node.siteId !== scope.siteId) {
    throw new AppError("You can only request maintenance for nodes at your assigned site/plant.", 403);
  }

  const data: Prisma.NodeMaintenanceRequestUncheckedCreateInput = {
    nodeId,
    issueType: input.issueType,
    description: input.description
  };
  if (userId) data.requestedById = userId;

  const request = await prisma.nodeMaintenanceRequest.create({
    data
  });

  await createStatusLog({
    nodeId,
    fromStatus: node.status,
    toStatus: node.status,
    action: "node.maintenance.requested",
    message: `${input.issueType}: ${input.description.slice(0, 160)}`,
    metadata: { maintenanceRequestId: request.id },
    userId
  });
  await recordAuditLog({
    action: "node.maintenance.request",
    entityType: "EdgeNode",
    entityId: nodeId,
    message: `Maintenance requested for ${node.name}`,
    metadata: {
      maintenanceRequestId: request.id,
      issueType: input.issueType
    },
    userId
  });

  const payload = {
    id: request.id,
    nodeId,
    issueType: request.issueType,
    description: request.description,
    status: request.status,
    requestedById: request.requestedById,
    createdAt: request.createdAt.toISOString()
  };
  safeEmit(NODE_MAINTENANCE_REQUEST_EVENT, payload);

  return payload;
};

export type NodeResolution = {
  node: {
    id: string;
    deviceKey: string | null;
    serialNumber: string | null;
    name: string;
    location: string;
    latitude: number | null;
    longitude: number | null;
    status: NodeStatus;
    firmwareVersion: string | null;
    batteryLevel: number | null;
    signalStrength: number | null;
    isActive: boolean;
    lastSeen: Date | null;
    createdAt: Date;
  };
  isNewNode: boolean;
};

export const resolveNodeForIngestion = async (nodeId?: string, deviceKey?: string): Promise<NodeResolution> => {
  if (nodeId) {
    const existingNode = await prisma.edgeNode.findUnique({ where: { id: nodeId } });
    if (!existingNode) {
      throw new AppError("Provided nodeId does not exist.", 404);
    }
    if (existingNode.isActive === false) {
      throw new AppError("Node is currently suspended and cannot ingest data.", 403);
    }

    return {
      node: existingNode,
      isNewNode: false
    };
  }

  if (deviceKey) {
    const existingDeviceNode = await prisma.edgeNode.findUnique({
      where: { deviceKey }
    });
    if (existingDeviceNode) {
      if (existingDeviceNode.isActive === false) {
        throw new AppError("Node is currently suspended and cannot ingest data.", 403);
      }
      return {
        node: existingDeviceNode,
        isNewNode: false
      };
    }

    const createdDeviceNode = await prisma.edgeNode.create({
      data: {
        deviceKey,
        serialNumber: deviceKey,
        name: `Edge Node ${deviceKey}`,
        location: "Unknown",
        status: NodeStatus.online
      }
    });

    await createStatusLog({
      nodeId: createdDeviceNode.id,
      toStatus: createdDeviceNode.status,
      action: "node.autoCreated",
      message: `Auto-created node for device ${deviceKey}`
    });

    return {
      node: createdDeviceNode,
      isNewNode: true
    };
  }

  const existingDefaultNode = await prisma.edgeNode.findUnique({
    where: { id: "gridflex-default-node" }
  });

  if (existingDefaultNode) {
    return {
      node: existingDefaultNode,
      isNewNode: false
    };
  }

  const createdDefaultNode = await prisma.edgeNode.create({
    data: {
      id: "gridflex-default-node",
      serialNumber: "GRIDFLEX-DEFAULT",
      name: "GridFlex Auto-Ingest Node",
      location: "Unknown",
      status: NodeStatus.online
    }
  });

  await createStatusLog({
    nodeId: createdDefaultNode.id,
    toStatus: createdDefaultNode.status,
    action: "node.autoCreated",
    message: "Auto-created default ingestion node"
  });

  return {
    node: createdDefaultNode,
    isNewNode: true
  };
};

export const updateNodeTelemetryMetadata = async (
  id: string,
  patch: NodeTelemetryPatch
) => {
  const data: Prisma.EdgeNodeUpdateInput = {};
  if (typeof patch.batteryLevel === "number") data.batteryLevel = patch.batteryLevel;
  if (typeof patch.signalStrength === "number") data.signalStrength = patch.signalStrength;
  if (typeof patch.firmwareVersion === "string") data.firmwareVersion = patch.firmwareVersion;
  if (typeof patch.location === "string") data.location = patch.location;
  if (typeof patch.latitude === "number") data.latitude = patch.latitude;
  if (typeof patch.longitude === "number") data.longitude = patch.longitude;

  if (Object.keys(data).length === 0) {
    return null;
  }

  return prisma.edgeNode.update({
    where: { id },
    data,
    select: {
      id: true,
      serialNumber: true,
      name: true,
      location: true,
      status: true,
      batteryLevel: true,
      signalStrength: true,
      firmwareVersion: true,
      lastSeen: true,
      createdAt: true
    }
  });
};
