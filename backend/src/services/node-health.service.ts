import { NodeHealthState, NodeStatus, Prisma } from "@prisma/client";

import { NODE_STATUS_UPDATE_EVENT } from "../config/constants.js";
import { getSocketServer } from "../config/socket.js";
import { prisma } from "../lib/prisma.js";
import { calculateDataFreshness } from "../domain/units.js";
import { logger } from "../utils/logger.js";

const toLegacyStatus = (health: NodeHealthState): NodeStatus => {
  if (health === "maintenance") return NodeStatus.maintenance;
  if (health === "online" || health === "stale" || health === "degraded") return NodeStatus.online;
  return NodeStatus.offline;
};

export const evaluateNodeHealth = async (now = new Date()) => {
  const nodes = await prisma.edgeNode.findMany({
    select: {
      id: true,
      name: true,
      status: true,
      healthState: true,
      isActive: true,
      lastSeen: true,
      lastSuccessfulIngestAt: true,
      batteryLevel: true,
      signalStrength: true,
      staleAfterSec: true,
      offlineAfterSec: true
    }
  });

  let transitions = 0;

  for (const node of nodes) {
    let nextState: NodeHealthState = node.healthState;

    if (!node.isActive) {
      nextState = "disabled";
    } else if (node.status === NodeStatus.maintenance) {
      nextState = "maintenance";
    } else {
      const reference = node.lastSuccessfulIngestAt ?? node.lastSeen;
      const freshness = calculateDataFreshness(reference, {
        now,
        staleAfterSeconds: node.staleAfterSec,
        offlineAfterSeconds: node.offlineAfterSec
      });

      if (freshness.isOffline) {
        nextState = "offline";
      } else if (
        freshness.isStale ||
        (typeof node.batteryLevel === "number" && node.batteryLevel < 20) ||
        (typeof node.signalStrength === "number" && node.signalStrength < 25)
      ) {
        nextState =
          typeof node.batteryLevel === "number" && node.batteryLevel < 20
            ? "degraded"
            : "stale";
      } else {
        nextState = "online";
      }
    }

    if (nextState === node.healthState) {
      continue;
    }

    const updated = await prisma.edgeNode.update({
      where: { id: node.id },
      data: {
        healthState: nextState,
        status: toLegacyStatus(nextState)
      }
    });

    await prisma.nodeHealthHistory.create({
      data: {
        nodeId: node.id,
        fromState: node.healthState,
        toState: nextState,
        reason: "scheduled.health.evaluation",
        metadata: {
          batteryLevel: node.batteryLevel,
          signalStrength: node.signalStrength,
          lastSeen: node.lastSeen?.toISOString() ?? null
        } as Prisma.InputJsonValue
      }
    });

    const io = getSocketServer();
    io?.emit(NODE_STATUS_UPDATE_EVENT, {
      id: updated.id,
      name: updated.name,
      status: updated.status,
      healthState: updated.healthState,
      lastSeen: updated.lastSeen
    });

    transitions += 1;
  }

  return { evaluated: nodes.length, transitions };
};

let healthTimer: ReturnType<typeof setInterval> | null = null;

export const startNodeHealthMonitor = () => {
  if (healthTimer) return;
  // Evaluate every 60s; cron string is informational for operators.
  healthTimer = setInterval(() => {
    void evaluateNodeHealth().catch((error) => {
      logger.error("Node health evaluation failed", {
        error: error instanceof Error ? error.message : String(error)
      });
    });
  }, 60_000);
  void evaluateNodeHealth().catch(() => undefined);
};

export const stopNodeHealthMonitor = () => {
  if (healthTimer) {
    clearInterval(healthTimer);
    healthTimer = null;
  }
};
