import { decodeRegisterWords, planRegisterBatches } from "./decode.js";
import { assertNoWriteRegisters, parseVerifiedInverterMap } from "./map-loader.js";
import {
  createModbusTcpReadonlyTransport,
  type ModbusTcpTransport
} from "./modbus-tcp-transport.js";
import type {
  CommunicationHealthMetrics,
  DecodedRegisterValue,
  VerifiedInverterMap
} from "./types.js";

export type VerifiedInverterAdapterConfig = {
  host: string;
  port?: number;
  timeoutMs?: number;
  maxRegistersPerBatch?: number;
  /** Base delay for exponential reconnect backoff (ms). */
  reconnectBaseMs?: number;
  reconnectMaxMs?: number;
  /** Max connect attempts before failing (default 8). */
  maxReconnectAttempts?: number;
  calibrationVersion?: string;
};

/**
 * Pilot read-only inverter adapter.
 * - FC03 holding-register reads only
 * - No Modbus write function codes
 * - Decodes via attested RegisterDefinition map
 * - Exponential reconnect backoff + communication health metrics
 */
export class VerifiedReadOnlyInverterAdapter {
  private readonly map: VerifiedInverterMap;
  private transport: ModbusTcpTransport | null = null;
  private readonly config: Required<
    Pick<
      VerifiedInverterAdapterConfig,
      | "port"
      | "timeoutMs"
      | "maxRegistersPerBatch"
      | "reconnectBaseMs"
      | "reconnectMaxMs"
      | "maxReconnectAttempts"
    >
  > &
    VerifiedInverterAdapterConfig;
  private metrics: CommunicationHealthMetrics = {
    connected: false,
    lastSuccessAt: null,
    lastFailureAt: null,
    consecutiveFailures: 0,
    totalReads: 0,
    totalFailures: 0,
    averageLatencyMs: null,
    reconnectAttempts: 0,
    circuitBreaker: "closed",
    detail: "idle"
  };
  private latencySamples: number[] = [];

  constructor(
    mapInput: unknown,
    config: VerifiedInverterAdapterConfig,
    private readonly transportFactory: (cfg: {
      host: string;
      port: number;
      unitId: number;
      timeoutMs: number;
    }) => ModbusTcpTransport = createModbusTcpReadonlyTransport
  ) {
    this.map = parseVerifiedInverterMap(mapInput);
    assertNoWriteRegisters(this.map);
    this.config = {
      port: 502,
      timeoutMs: 3000,
      maxRegistersPerBatch: 32,
      reconnectBaseMs: 500,
      reconnectMaxMs: 30_000,
      maxReconnectAttempts: 8,
      ...config
    };
  }

  getMap(): VerifiedInverterMap {
    return this.map;
  }

  /**
   * Hard-fail: write path is not implemented for the pilot.
   * Kept as a named method so static analysis / CI can assert absence of FC06/FC16 usage.
   */
  async writePoint(_key: string, _value: number): Promise<never> {
    throw new Error(
      "Pilot verified inverter adapter is read-only. Modbus write function codes are not implemented."
    );
  }

  async connect(): Promise<void> {
    await this.connectWithBackoff();
  }

  async disconnect(): Promise<void> {
    if (this.transport) {
      await this.transport.disconnect();
      this.transport = null;
    }
    this.metrics.connected = false;
    this.metrics.detail = "disconnected";
  }

  async readAll(): Promise<DecodedRegisterValue[]> {
    return this.readKeys(this.map.registers.map((r) => r.key));
  }

  async readKeys(keys: string[]): Promise<DecodedRegisterValue[]> {
    await this.ensureConnected();
    const selected = this.map.registers.filter((r) => keys.includes(r.key));
    if (selected.length === 0) {
      return [];
    }

    const batches = planRegisterBatches(selected, this.config.maxRegistersPerBatch);
    const registerBank = new Map<number, number>();
    const receivedAt = new Date().toISOString();

    for (const batch of batches) {
      const started = Date.now();
      try {
        const words = await this.transport!.readHoldingRegisters(batch.startAddress, batch.quantity);
        this.recordSuccess(Date.now() - started);
        for (let i = 0; i < words.length; i += 1) {
          registerBank.set(batch.startAddress + i, words[i]!);
        }
      } catch (error) {
        this.recordFailure(error);
        await this.reconnectAfterFailure();
        throw error;
      }
    }

    return selected.map((definition) => {
      const raw: number[] = [];
      for (let i = 0; i < definition.length; i += 1) {
        raw.push(registerBank.get(definition.address + i) ?? 0xffff);
      }
      return decodeRegisterWords(definition, raw, {
        measuredAt: receivedAt,
        receivedAt,
        ...(this.config.calibrationVersion
          ? { calibrationVersion: this.config.calibrationVersion }
          : {})
      });
    });
  }

  health(): CommunicationHealthMetrics {
    return { ...this.metrics };
  }

  private async ensureConnected(): Promise<void> {
    if (this.transport?.isConnected()) {
      return;
    }
    await this.connectWithBackoff();
  }

  private async connectWithBackoff(): Promise<void> {
    let attempt = 0;
    let delay = this.config.reconnectBaseMs;
    let lastError: unknown;

    while (attempt < this.config.maxReconnectAttempts) {
      attempt += 1;
      this.metrics.reconnectAttempts += 1;
      try {
        this.transport = this.transportFactory({
          host: this.config.host,
          port: this.config.port,
          unitId: this.map.equipment.slaveId,
          timeoutMs: this.config.timeoutMs
        });
        await this.transport.connect();
        this.metrics.connected = true;
        this.metrics.circuitBreaker = "closed";
        this.metrics.consecutiveFailures = 0;
        this.metrics.detail = `connected attempt=${attempt}`;
        return;
      } catch (error) {
        lastError = error;
        this.recordFailure(error);
        this.metrics.circuitBreaker = attempt >= 3 ? "open" : "half_open";
        this.metrics.detail = `reconnect backoff ${delay}ms: ${
          error instanceof Error ? error.message : String(error)
        }`;
        if (attempt >= this.config.maxReconnectAttempts) {
          break;
        }
        await sleep(delay);
        delay = Math.min(this.config.reconnectMaxMs, delay * 2);
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error(`Modbus connect failed after ${this.config.maxReconnectAttempts} attempts.`);
  }

  private async reconnectAfterFailure(): Promise<void> {
    if (this.transport) {
      await this.transport.disconnect().catch(() => undefined);
      this.transport = null;
    }
    this.metrics.connected = false;
  }

  private recordSuccess(latencyMs: number): void {
    this.metrics.totalReads += 1;
    this.metrics.consecutiveFailures = 0;
    this.metrics.lastSuccessAt = new Date().toISOString();
    this.metrics.circuitBreaker = "closed";
    this.latencySamples.push(latencyMs);
    if (this.latencySamples.length > 50) {
      this.latencySamples.shift();
    }
    this.metrics.averageLatencyMs =
      this.latencySamples.reduce((a, b) => a + b, 0) / this.latencySamples.length;
  }

  private recordFailure(error: unknown): void {
    this.metrics.totalFailures += 1;
    this.metrics.consecutiveFailures += 1;
    this.metrics.lastFailureAt = new Date().toISOString();
    this.metrics.detail = error instanceof Error ? error.message : String(error);
  }
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/** Static proof for CI: write function codes are not part of this module's public API. */
export const PILOT_MODBUS_ALLOWED_FUNCTION_CODES = [0x03] as const;
export const PILOT_MODBUS_FORBIDDEN_FUNCTION_CODES = [0x05, 0x06, 0x0f, 0x10] as const;
