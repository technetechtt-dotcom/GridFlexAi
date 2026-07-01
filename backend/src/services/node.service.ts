import { NodeStatus } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/AppError.js";

export const listNodesWithLastReading = async () => {
  const nodes = await prisma.edgeNode.findMany({
    orderBy: [{ createdAt: "desc" }],
    include: {
      readings: {
        orderBy: [{ timestamp: "desc" }],
        take: 1
      }
    }
  });

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [windowStats, lastEnergyToday] = await Promise.all([
    prisma.sensorReading.groupBy({
      by: ["nodeId"],
      where: {
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

  return nodes.map((node) => {
    const stats = statsByNode.get(node.id);
    const avgPower = stats?._avg.power;
    return {
      id: node.id,
      deviceKey: node.deviceKey,
      name: node.name,
      location: node.location,
      latitude: node.latitude,
      longitude: node.longitude,
      status: node.status,
      isActive: node.isActive,
      lastSeen: node.lastSeen,
      createdAt: node.createdAt,
      lastReading: node.readings[0] ?? null,
      latestReadingSummary: {
        latestTimestamp: node.readings[0]?.timestamp ?? null,
        latestPowerKw: node.readings[0]?.power ?? null,
        latestVoltage: node.readings[0]?.voltage ?? null,
        latestCurrent: node.readings[0]?.current ?? null,
        avgPower24h: typeof avgPower === "number" ? Number(avgPower.toFixed(2)) : null,
        samples24h: stats?._count._all ?? 0,
        energyTodayKwh: energyByNode.get(node.id) ?? null
      }
    };
  });
};

export type NodeResolution = {
  node: {
    id: string;
    deviceKey: string | null;
    name: string;
    location: string;
    latitude: number | null;
    longitude: number | null;
    status: NodeStatus;
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
        name: `Edge Node ${deviceKey}`,
        location: "Unknown",
        status: NodeStatus.online
      }
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
      name: "GridFlex Auto-Ingest Node",
      location: "Unknown",
      status: NodeStatus.online
    }
  });

  return {
    node: createdDefaultNode,
    isNewNode: true
  };
};
