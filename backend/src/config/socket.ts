import { Server as SocketIOServer } from "socket.io";

let ioInstance: SocketIOServer | null = null;

export const setSocketServer = (io: SocketIOServer): void => {
  ioInstance = io;
};

export const getSocketServer = (): SocketIOServer => {
  if (!ioInstance) {
    throw new Error("Socket.io server has not been initialized yet.");
  }
  return ioInstance;
};
