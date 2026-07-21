import { io, type Socket } from "socket.io-client";
import { getAuthToken, tryRefreshAccessToken, type NodeStatus } from "./api";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:4000/api";
const SOCKET_BASE_URL =
  (import.meta.env.VITE_SOCKET_BASE_URL as string | undefined) ??
  API_BASE_URL.replace(/\/api\/?$/, "");

let liveSocket: Socket | null = null;
let simulationSocket: Socket | null = null;

const keepSocketAuthCurrent = (socket: Socket): Socket => {
  let refreshingSession = false;

  socket.io.on("reconnect_attempt", () => {
    const token = getAuthToken();
    socket.auth = token ? { token } : {};
  });
  socket.on("session-expired", () => {
    if (refreshingSession) return;
    refreshingSession = true;
    void tryRefreshAccessToken()
      .then((refreshed) => {
        const token = getAuthToken();
        socket.auth = token ? { token } : {};
        if (refreshed && token) socket.connect();
      })
      .finally(() => {
        refreshingSession = false;
      });
  });
  return socket;
};

export type LiveReadingPayload = {
  id: string;
  nodeId: string;
  voltage: number;
  current: number;
  power: number;
  energyToday?: number | null;
  inverterPower?: number | null;
  curtailment?: number | null;
  timestamp: string;
  environment?: "live" | "simulation" | "hil";
  simulationRunId?: string | null;
  node?: {
    id: string;
    name: string;
    location: string;
    status: NodeStatus;
  };
};

export type NodeStatusUpdatePayload = {
  id: string;
  serialNumber: string | null;
  name: string;
  location: string;
  status: NodeStatus;
  firmwareVersion: string | null;
  batteryLevel: number | null;
  signalStrength: number | null;
  lastSeen: string | null;
  createdAt: string;
};

/** Default namespace — measured / live advisory stream. */
export const getLiveSocketClient = (): Socket => {
  if (!liveSocket) {
    const token = getAuthToken();
    liveSocket = keepSocketAuthCurrent(io(SOCKET_BASE_URL, {
      transports: ["websocket", "polling"],
      autoConnect: true,
      withCredentials: true,
      auth: token ? { token } : undefined
    }));
  }
  return liveSocket;
};

/** Dedicated /simulation namespace — never mixed with live rooms. */
export const getSimulationSocketClient = (): Socket => {
  if (!simulationSocket) {
    const token = getAuthToken();
    simulationSocket = keepSocketAuthCurrent(io(`${SOCKET_BASE_URL}/simulation`, {
      transports: ["websocket", "polling"],
      autoConnect: true,
      withCredentials: true,
      auth: token ? { token } : undefined
    }));
  }
  return simulationSocket;
};

/** @deprecated Prefer getLiveSocketClient */
export const getSocketClient = getLiveSocketClient;

export const closeLiveSocketClient = (): void => {
  if (liveSocket) {
    liveSocket.disconnect();
    liveSocket = null;
  }
};

export const closeSimulationSocketClient = (): void => {
  if (simulationSocket) {
    simulationSocket.disconnect();
    simulationSocket = null;
  }
};

/** @deprecated Prefer closeLiveSocketClient */
export const closeSocketClient = (): void => {
  closeLiveSocketClient();
  closeSimulationSocketClient();
};
