import type { Server as SocketIOServer, Socket } from "socket.io";

import type { AccessScope } from "../middleware/permissions.js";
import { resolveAccessScope } from "../middleware/permissions.js";
import { verifyAccessToken } from "../utils/jwt.js";
import { logger } from "../utils/logger.js";
import { recordAuditLog } from "../services/audit-log.service.js";

export const organisationRoom = (organisationId: string): string => `org:${organisationId}`;
export const siteRoom = (siteId: string): string => `site:${siteId}`;
export const GLOBAL_OPS_ROOM = "ops:global";

const extractBearerOrAuthToken = (socket: Socket): string | null => {
  const authToken = socket.handshake.auth?.token;
  if (typeof authToken === "string" && authToken.trim()) {
    return authToken.trim();
  }

  const header = socket.handshake.headers.authorization;
  if (typeof header === "string" && header.startsWith("Bearer ")) {
    return header.slice("Bearer ".length).trim();
  }

  const cookieHeader = socket.handshake.headers.cookie;
  if (typeof cookieHeader === "string") {
    const match = cookieHeader.match(/(?:^|;\s*)accessToken=([^;]+)/);
    if (match?.[1]) {
      return decodeURIComponent(match[1]);
    }
  }

  return null;
};

export const joinRoomsForScope = async (socket: Socket, scope: AccessScope): Promise<string[]> => {
  const rooms: string[] = [];
  if (scope.kind === "global") {
    rooms.push(GLOBAL_OPS_ROOM);
  } else if (scope.kind === "organisation") {
    for (const organisationId of scope.organisationIds) {
      rooms.push(organisationRoom(organisationId));
    }
  } else if (scope.kind === "site") {
    for (const siteId of scope.siteIds) {
      rooms.push(siteRoom(siteId));
    }
    for (const organisationId of scope.organisationIds) {
      rooms.push(organisationRoom(organisationId));
    }
  }

  await Promise.all(rooms.map((room) => socket.join(room)));
  return rooms;
};

export const emitToSiteScope = (
  io: SocketIOServer,
  eventName: string,
  payload: unknown,
  options?: { siteId?: string | null; organisationId?: string | null }
): void => {
  const { siteId, organisationId } = options ?? {};

  if (siteId) {
    io.to(siteRoom(siteId)).emit(eventName, payload);
  }
  if (organisationId) {
    io.to(organisationRoom(organisationId)).emit(eventName, payload);
  }
  // Platform operators always receive scoped operational events.
  io.to(GLOBAL_OPS_ROOM).emit(eventName, payload);
};

export const configureAuthenticatedSockets = (io: SocketIOServer): void => {
  io.use((socket, next) => {
    try {
      const token = extractBearerOrAuthToken(socket);
      if (!token) {
        next(new Error("Unauthorized socket connection."));
        return;
      }
      const payload = verifyAccessToken(token);
      socket.data.user = {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        role: payload.role
      };
      next();
    } catch {
      next(new Error("Unauthorized socket connection."));
    }
  });
};

export const registerScopedSocketConnection = (
  io: SocketIOServer,
  onMetricsConnect: () => void,
  onMetricsDisconnect: () => void,
  liveEventName: string
): void => {
  configureAuthenticatedSockets(io);

  io.on("connection", (socket) => {
    onMetricsConnect();

    void (async () => {
      try {
        const user = socket.data.user as { id: string; role: "admin" | "developer" | "manager" | "operator"; email: string };
        const scope = await resolveAccessScope(user.id, user.role);
        const rooms = await joinRoomsForScope(socket, scope);

        if (scope.kind === "global") {
          await recordAuditLog({
            action: "access.super_admin.socket_join",
            entityType: "Socket",
            entityId: socket.id,
            message: `Platform admin joined global Socket.IO rooms`,
            userId: user.id,
            metadata: { rooms, email: user.email }
          });
        }

        socket.emit("connected", {
          message: "Connected to GridFlex real-time gateway.",
          liveEvent: liveEventName,
          rooms,
          scopeKind: scope.kind
        });
      } catch (error) {
        logger.error("Failed to join tenant socket rooms", {
          error: error instanceof Error ? error.message : String(error)
        });
        socket.emit("connected", {
          message: "Connected without tenant rooms.",
          liveEvent: liveEventName,
          rooms: [],
          scopeKind: "none"
        });
      }
    })();

    socket.on("disconnect", () => {
      onMetricsDisconnect();
    });
  });
};
