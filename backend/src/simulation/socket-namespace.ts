import type { Server as SocketIOServer, Namespace } from "socket.io";

import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import {
  authenticateSocket,
  emitToSiteScope,
  joinRoomsForScope
} from "../lib/socket-rooms.js";
import { resolveAccessScope } from "../middleware/permissions.js";

export const SIMULATION_NAMESPACE = "/simulation";
export const SIMULATION_TELEMETRY_EVENT = "simulation-reading";

let simulationNamespace: Namespace | null = null;

export const getSimulationNamespace = (): Namespace | null => simulationNamespace;

/**
 * Dedicated Socket.IO namespace for simulated telemetry.
 * Live measured readings must never be emitted here (and simulation never on default /live rooms).
 */
export const registerSimulationNamespace = (io: SocketIOServer): Namespace => {
  simulationNamespace = io.of(SIMULATION_NAMESPACE);
  simulationNamespace.use(authenticateSocket);

  simulationNamespace.on("connection", (socket) => {
    const expiresAtMs = socket.data.tokenExpiresAtMs as number | null;
    const expiryTimer = expiresAtMs
      ? setTimeout(() => {
          socket.emit("session-expired", { reason: "access_token_expired" });
          socket.disconnect(true);
        }, Math.max(0, expiresAtMs - Date.now()))
      : null;

    void (async () => {
      try {
        const user = socket.data.user as {
          id: string;
          role: "admin" | "developer" | "manager" | "operator";
        };
        const scope = await resolveAccessScope(user.id, user.role);
        const rooms = await joinRoomsForScope(socket, scope);
        logger.info("Client joined scoped /simulation rooms.", {
          socketId: socket.id,
          scopeKind: scope.kind,
          rooms
        });
        socket.emit("operating-mode", {
          mode: env.GRIDFLEX_OPERATING_MODE,
          namespace: SIMULATION_NAMESPACE,
          rooms,
          scopeKind: scope.kind
        });
      } catch (error) {
        logger.error("Failed to join simulation tenant rooms.", {
          socketId: socket.id,
          error: error instanceof Error ? error.message : String(error)
        });
        socket.emit("operating-mode", {
          mode: env.GRIDFLEX_OPERATING_MODE,
          namespace: SIMULATION_NAMESPACE,
          rooms: [],
          scopeKind: "none"
        });
      }
    })();
    socket.on("disconnect", () => {
      if (expiryTimer) clearTimeout(expiryTimer);
    });
  });

  return simulationNamespace;
};

export const emitSimulationReading = (
  payload: unknown,
  target: { siteId: string; organisationId: string }
): void => {
  if (!simulationNamespace) {
    return;
  }
  emitToSiteScope(simulationNamespace, SIMULATION_TELEMETRY_EVENT, payload, target);
};
