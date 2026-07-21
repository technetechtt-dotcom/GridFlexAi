import type { Server as SocketIOServer, Namespace } from "socket.io";

import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { authenticateSocket } from "../lib/socket-rooms.js";

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

    logger.info("Client joined /simulation namespace.", { socketId: socket.id });
    socket.emit("operating-mode", {
      mode: env.GRIDFLEX_OPERATING_MODE,
      namespace: SIMULATION_NAMESPACE
    });
    socket.on("disconnect", () => {
      if (expiryTimer) clearTimeout(expiryTimer);
    });
  });

  return simulationNamespace;
};

export const emitSimulationReading = (payload: unknown): void => {
  if (!simulationNamespace) {
    return;
  }
  simulationNamespace.emit(SIMULATION_TELEMETRY_EVENT, payload);
};
