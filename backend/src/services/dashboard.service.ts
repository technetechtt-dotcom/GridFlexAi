import { NodeStatus, Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { getOptionalSiteAccessScope, type AccessActor } from "./access-scope.service.js";
import { getForecastProvidersStatus } from "./forecast.service.js";

export const getDashboardOverview = async (actor?: AccessActor) => {
  const scope = await getOptionalSiteAccessScope(actor);
  const nodeWhere: Prisma.EdgeNodeWhereInput = scope.kind === "site" ? { siteId: scope.siteId } : {};
  const readingWhere: Prisma.SensorReadingWhereInput = scope.kind === "site"
    ? {
        node: {
          is: {
            siteId: scope.siteId
          }
        }
      }
    : {};

  const [totalNodes, onlineNodes, latestReadings] = await Promise.all([
    prisma.edgeNode.count({ where: nodeWhere }),
    prisma.edgeNode.count({
      where: {
        ...nodeWhere,
        status: NodeStatus.online
      }
    }),
    prisma.sensorReading.findMany({
      where: readingWhere,
      take: 200,
      orderBy: [{ timestamp: "desc" }],
      select: {
        voltage: true,
        current: true,
        power: true,
        inverterPower: true,
        curtailment: true,
        timestamp: true
      }
    })
  ]);

  const totals = latestReadings.reduce(
    (acc, reading) => {
      acc.voltage += reading.voltage;
      acc.current += reading.current;
      acc.power += reading.power;
      acc.inverterPower += reading.inverterPower ?? 0;
      acc.curtailment += reading.curtailment ?? 0;
      return acc;
    },
    { voltage: 0, current: 0, power: 0, inverterPower: 0, curtailment: 0 }
  );

  const count = latestReadings.length || 1;

  return {
    nodes: {
      total: totalNodes,
      online: onlineNodes,
      offline: Math.max(totalNodes - onlineNodes, 0)
    },
    readingsWindow: latestReadings.length,
    averages: {
      voltage: Number((totals.voltage / count).toFixed(2)),
      current: Number((totals.current / count).toFixed(2)),
      power: Number((totals.power / count).toFixed(2)),
      inverterPower: Number((totals.inverterPower / count).toFixed(2)),
      curtailment: Number((totals.curtailment / count).toFixed(2))
    },
    latestTimestamp: latestReadings[0]?.timestamp ?? null
  };
};

export const getAdminDashboardOverview = async () => {
  const now = new Date();
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const staleCutoff = new Date(now.getTime() - 30 * 60 * 1000);

  const [
    usersTotal,
    activeSessions,
    nodesTotal,
    nodesOnline,
    nodesOffline,
    staleNodes,
    readings24h,
    curtailmentAggregates,
    latestUsers,
    nodesWithLatestReading,
    readingTimestamps
  ] = await Promise.all([
    prisma.user.count(),
    prisma.refreshToken.count({
      where: {
        revokedAt: null,
        expiresAt: {
          gt: now
        }
      }
    }),
    prisma.edgeNode.count(),
    prisma.edgeNode.count({ where: { status: NodeStatus.online } }),
    prisma.edgeNode.count({ where: { status: NodeStatus.offline } }),
    prisma.edgeNode.count({
      where: {
        OR: [
          { lastSeen: null },
          {
            lastSeen: {
              lt: staleCutoff
            }
          }
        ]
      }
    }),
    prisma.sensorReading.count({
      where: {
        timestamp: {
          gte: since24h
        }
      }
    }),
    prisma.sensorReading.groupBy({
      by: ["nodeId"],
      where: {
        timestamp: {
          gte: since24h
        },
        curtailment: {
          not: null
        }
      },
      _avg: {
        curtailment: true
      }
    }),
    prisma.user.findMany({
      orderBy: [{ createdAt: "desc" }],
      take: 5,
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true
      }
    }),
    prisma.edgeNode.findMany({
      orderBy: [{ createdAt: "desc" }],
      take: 8,
      select: {
        id: true,
        name: true,
        location: true,
        status: true,
        lastSeen: true,
        readings: {
          orderBy: [{ timestamp: "desc" }],
          take: 1,
          select: {
            power: true,
            curtailment: true,
            timestamp: true
          }
        }
      }
    }),
    prisma.sensorReading.findMany({
      where: {
        timestamp: {
          gte: since24h
        }
      },
      select: {
        timestamp: true
      }
    })
  ]);

  const highCurtailmentNodes = curtailmentAggregates.filter((entry) => (entry._avg.curtailment ?? 0) >= 2).length;

  const ingestionBuckets = new Map<string, number>();
  for (let i = 23; i >= 0; i -= 1) {
    const bucketDate = new Date(now.getTime() - i * 60 * 60 * 1000);
    const key = `${bucketDate.getUTCHours().toString().padStart(2, "0")}:00`;
    ingestionBuckets.set(key, 0);
  }
  for (const row of readingTimestamps) {
    const bucket = new Date(row.timestamp);
    const key = `${bucket.getUTCHours().toString().padStart(2, "0")}:00`;
    ingestionBuckets.set(key, (ingestionBuckets.get(key) ?? 0) + 1);
  }

  const providers = getForecastProvidersStatus().providers;

  return {
    generatedAt: now.toISOString(),
    overview: {
      usersTotal,
      activeSessions,
      nodesTotal,
      nodesOnline,
      nodesOffline,
      staleNodes,
      readings24h
    },
    alerts: {
      offlineNodes: nodesOffline,
      staleNodes,
      highCurtailmentNodes
    },
    providerHealth: {
      forecastSolar: providers.forecastSolar.state,
      openWeather: providers.openWeather.state,
      openWeatherConfigured: providers.openWeather.configured,
      accuWeather: providers.accuWeather.state,
      accuWeatherConfigured: providers.accuWeather.configured
    },
    ingestionHourly: Array.from(ingestionBuckets.entries()).map(([hour, readings]) => ({
      hour,
      readings
    })),
    recentUsers: latestUsers.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt.toISOString()
    })),
    nodes: nodesWithLatestReading.map((node) => ({
      id: node.id,
      name: node.name,
      location: node.location,
      status: node.status,
      lastSeen: node.lastSeen?.toISOString() ?? null,
      latestReading: node.readings[0] ?
        {
          powerKw: node.readings[0].power,
          curtailmentKw: node.readings[0].curtailment,
          timestamp: node.readings[0].timestamp.toISOString()
        } :
        null
    }))
  };
};
