import { connect as netConnect, type Socket } from "node:net";

/**
 * Minimal Modbus TCP client — function code 0x03 (Read Holding Registers) only.
 * No write function codes (0x06 / 0x10 / etc.) are implemented or exported.
 */

export type ModbusTcpTransportConfig = {
  host: string;
  port: number;
  unitId: number;
  timeoutMs: number;
};

export type ModbusTcpTransport = {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  readHoldingRegisters(address: number, quantity: number): Promise<number[]>;
  isConnected(): boolean;
};

const FC_READ_HOLDING = 0x03;

export const createModbusTcpReadonlyTransport = (
  config: ModbusTcpTransportConfig
): ModbusTcpTransport => {
  let socket: Socket | null = null;
  let transactionId = 1;
  let connected = false;

  const nextTransactionId = (): number => {
    transactionId = (transactionId + 1) & 0xffff;
    return transactionId || 1;
  };

  const ensureConnected = (): Socket => {
    if (!socket || !connected) {
      throw new Error("Modbus TCP transport is not connected.");
    }
    return socket;
  };

  const readExact = (sock: Socket, length: number, timeoutMs: number): Promise<Buffer> =>
    new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let received = 0;
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`Modbus TCP read timed out after ${timeoutMs}ms.`));
      }, timeoutMs);

      const onData = (chunk: Buffer) => {
        chunks.push(chunk);
        received += chunk.length;
        if (received >= length) {
          cleanup();
          resolve(Buffer.concat(chunks).subarray(0, length));
        }
      };
      const onError = (err: Error) => {
        cleanup();
        reject(err);
      };
      const onClose = () => {
        cleanup();
        reject(new Error("Modbus TCP socket closed during read."));
      };
      const cleanup = () => {
        clearTimeout(timer);
        sock.off("data", onData);
        sock.off("error", onError);
        sock.off("close", onClose);
      };
      sock.on("data", onData);
      sock.on("error", onError);
      sock.on("close", onClose);
    });

  return {
    isConnected: () => connected,

    async connect(): Promise<void> {
      if (connected && socket) {
        return;
      }
      socket = await new Promise<Socket>((resolve, reject) => {
        const sock = netConnect({ host: config.host, port: config.port });
        const timer = setTimeout(() => {
          sock.destroy();
          reject(new Error(`Modbus TCP connect timed out after ${config.timeoutMs}ms.`));
        }, config.timeoutMs);
        sock.once("connect", () => {
          clearTimeout(timer);
          resolve(sock);
        });
        sock.once("error", (err) => {
          clearTimeout(timer);
          reject(err);
        });
      });
      connected = true;
    },

    async disconnect(): Promise<void> {
      connected = false;
      if (socket) {
        socket.destroy();
        socket = null;
      }
    },

    async readHoldingRegisters(address: number, quantity: number): Promise<number[]> {
      if (quantity < 1 || quantity > 125) {
        throw new Error(`Invalid Modbus quantity ${quantity}.`);
      }
      const sock = ensureConnected();
      const tx = nextTransactionId();
      const pdu = Buffer.alloc(5);
      pdu.writeUInt8(FC_READ_HOLDING, 0);
      pdu.writeUInt16BE(address, 1);
      pdu.writeUInt16BE(quantity, 3);

      const mbap = Buffer.alloc(7);
      mbap.writeUInt16BE(tx, 0);
      mbap.writeUInt16BE(0, 2); // protocol id
      mbap.writeUInt16BE(pdu.length + 1, 4);
      mbap.writeUInt8(config.unitId, 6);

      const request = Buffer.concat([mbap, pdu]);
      sock.write(request);

      const header = await readExact(sock, 7, config.timeoutMs);
      const length = header.readUInt16BE(4);
      const unitId = header.readUInt8(6);
      if (unitId !== config.unitId) {
        throw new Error(`Modbus unit id mismatch: expected ${config.unitId}, got ${unitId}.`);
      }
      const body = await readExact(sock, length - 1, config.timeoutMs);
      const functionCode = body.readUInt8(0);
      if (functionCode === (FC_READ_HOLDING | 0x80)) {
        const exception = body.length > 1 ? body.readUInt8(1) : -1;
        throw new Error(`Modbus exception ${exception} on FC03.`);
      }
      if (functionCode !== FC_READ_HOLDING) {
        throw new Error(`Unexpected Modbus function code ${functionCode}; only FC03 is supported.`);
      }
      const byteCount = body.readUInt8(1);
      if (byteCount !== quantity * 2) {
        throw new Error(`Modbus byte count ${byteCount} does not match quantity ${quantity}.`);
      }
      const registers: number[] = [];
      for (let i = 0; i < quantity; i += 1) {
        registers.push(body.readUInt16BE(2 + i * 2));
      }
      return registers;
    }
  };
};

/** Test double — inject fixture register banks without opening sockets. */
export const createFixtureModbusTransport = (
  bank: Map<number, number>
): ModbusTcpTransport => {
  let connected = false;
  return {
    isConnected: () => connected,
    async connect() {
      connected = true;
    },
    async disconnect() {
      connected = false;
    },
    async readHoldingRegisters(address: number, quantity: number) {
      if (!connected) throw new Error("Fixture transport not connected.");
      const out: number[] = [];
      for (let i = 0; i < quantity; i += 1) {
        const value = bank.get(address + i);
        if (value === undefined) {
          throw new Error(`Fixture missing register at address ${address + i}.`);
        }
        out.push(value);
      }
      return out;
    }
  };
};
