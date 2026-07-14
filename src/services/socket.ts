import { io, type Socket } from "socket.io-client";
import type { NodeStatus } from "./api";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:4000/api";
const SOCKET_BASE_URL = API_BASE_URL.replace(/\/api\/?$/, "");

let socketInstance: Socket | null = null;

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

export const getSocketClient = (): Socket => {
  if (!socketInstance) {
    socketInstance = io(SOCKET_BASE_URL, {
      transports: ["websocket", "polling"],
      autoConnect: true
    });
  }

  return socketInstance;
};

export const closeSocketClient = (): void => {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
};
