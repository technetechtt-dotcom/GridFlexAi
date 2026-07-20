import { decodeRegisterWords, planRegisterBatches } from "./decode.js";
import { assertNoWriteRegisters, parseVerifiedInverterMap } from "./map-loader.js";
import {
  createModbusTcpReadonlyTransport,
  type ModbusTcpTransport
} from "./modbus-tcp-transport.js";
import { expandKeysWithScaleFactors } from "./register-plan.js";
import { discoverSunSpecModel, type SunSpecDiscoveryResult } from "./sunspec-discovery.js";
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
  /**
   * When true (default if PILOT_SUNSPEC_DISCOVER=true), run SunSpec discovery
   * after TCP connect and rebase Model 103 addresses to the discovered base.
   */
  discoverSunSpec?: boolean;
  /** Expected manufacturer substring for Common Model 1 Mn (optional). */
  expectedManufacturer?: string;
  /** Expected model substring for Common Model 1 Md (optional). */
  expectedModel?: string;
};

/**
 * Pilot read-only inverter adapter.
 * - FC03 holding-register reads only
 * - No Modbus write function codes
 * - Decodes via attested RegisterDefinition map
 * - Exponential reconnect backoff + communication health metrics
 */
export class VerifiedReadOnlyInverterAdapter {
  private map: VerifiedInverterMap;
  private transport: ModbusTcpTransport | null = null;
  private discovery: SunSpecDiscoveryResult | null = null;
  private identity: { manufacturer: string; model: string; serial: string } | null = null;
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
    const discoverEnv = process.env.PILOT_SUNSPEC_DISCOVER?.trim().toLowerCase();
    this.config = {
      port: 502,
      timeoutMs: 3000,
      maxRegistersPerBatch: 32,
      reconnectBaseMs: 500,
      reconnectMaxMs: 30_000,
      maxReconnectAttempts: 8,
      discoverSunSpec: discoverEnv === "true" || discoverEnv === "1",
      ...config
    };
  }

  getMap(): VerifiedInverterMap {
    return this.map;
  }

  getDiscovery(): SunSpecDiscoveryResult | null {
    return this.discovery;
  }

  getIdentity(): { manufacturer: string; model: string; serial: string } | null {
    return this.identity;
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
    if (this.config.discoverSunSpec) {
      await this.runSunSpecDiscovery();
    }
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
    const expanded = expandKeysWithScaleFactors(this.map.registers, keys);
    const selected = this.map.registers.filter((r) => expanded.includes(r.key));
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

    const scaleFactors: Record<string, number> = {};
    for (const definition of selected) {
      if (!definition.key.startsWith("sf_")) continue;
      const raw: number[] = [];
      for (let i = 0; i < definition.length; i += 1) {
        raw.push(registerBank.get(definition.address + i) ?? 0);
      }
      const decoded = decodeRegisterWords(
        { ...definition, scaleMode: "fixed", scale: 1 },
        raw,
        { measuredAt: receivedAt, receivedAt }
      );
      if (typeof decoded.rawDecoded === "number" && !decoded.unavailable) {
        // SunSpec sunssf N/A is −32768; also reject absurd exponents outside ±10.
        if (decoded.rawDecoded < -10 || decoded.rawDecoded > 10) {
          continue;
        }
        scaleFactors[definition.key] = decoded.rawDecoded;
      }
    }

    return selected
      .filter((definition) => !definition.key.startsWith("sf_"))
      .filter((definition) => keys.includes(definition.key))
      .map((definition) => {
        const raw: number[] = [];
        for (let i = 0; i < definition.length; i += 1) {
          raw.push(registerBank.get(definition.address + i) ?? 0xffff);
        }
        return decodeRegisterWords(definition, raw, {
          measuredAt: receivedAt,
          receivedAt,
          scaleFactors,
          ...(this.config.calibrationVersion
            ? { calibrationVersion: this.config.calibrationVersion }
            : {})
        });
      });
  }

  health(): CommunicationHealthMetrics {
    return { ...this.metrics };
  }

  private async runSunSpecDiscovery(): Promise<void> {
    if (!this.transport) {
      throw new Error("SunSpec discovery requires an active Modbus transport.");
    }
    const transport = this.transport;
    const result = await discoverSunSpecModel((start, quantity) =>
      transport.readHoldingRegisters(start, quantity)
    );
    if (result.modelId !== 103) {
      throw new Error(`Unsupported SunSpec model ${result.modelId}; expected Model 103.`);
    }

    const mappedBase = this.inferMappedModelBase();
    const delta = result.modelBaseZero - mappedBase;
    if (delta !== 0) {
      this.map = {
        ...this.map,
        registers: this.map.registers.map((r) => ({
          ...r,
          address: r.address + delta
        }))
      };
    }
    this.discovery = result;
    this.identity = await this.readCommonIdentity(result.commonBaseZero);
    this.assertIdentityAllowed(this.identity);
    this.metrics.detail = `sunspec model103@${result.modelBaseZero} mn=${this.identity.manufacturer}`;
  }

  private inferMappedModelBase(): number {
    const w = this.map.registers.find((r) => r.key === "active_power_kw");
    // Model 103 W point is offset 16 from model ID register.
    if (!w) return 0;
    return w.address - 16;
  }

  private async readCommonIdentity(
    commonBaseZero: number
  ): Promise<{ manufacturer: string; model: string; serial: string }> {
    // SunSpec Common Model 1: after SunS (2) + ID/L (2), Mn@4 len16, Md@20 len16, SN@52 len16 (approx offsets).
    const words = await this.transport!.readHoldingRegisters(commonBaseZero + 4, 64);
    const decodeStr = (start: number, len: number) => {
      const chars: string[] = [];
      for (let i = 0; i < len; i += 1) {
        const w = words[start + i] ?? 0;
        const hi = (w >> 8) & 0xff;
        const lo = w & 0xff;
        if (hi) chars.push(String.fromCharCode(hi));
        if (lo) chars.push(String.fromCharCode(lo));
      }
      return chars.join("").replace(/\0/g, "").trim();
    };
    return {
      manufacturer: decodeStr(0, 16),
      model: decodeStr(16, 16),
      serial: decodeStr(36, 16)
    };
  }

  private assertIdentityAllowed(identity: {
    manufacturer: string;
    model: string;
    serial: string;
  }): void {
    const expectedMn = this.config.expectedManufacturer ?? process.env.PILOT_INVERTER_EXPECTED_MN;
    const expectedMd = this.config.expectedModel ?? process.env.PILOT_INVERTER_EXPECTED_MD;
    if (expectedMn && !identity.manufacturer.toLowerCase().includes(expectedMn.toLowerCase())) {
      throw new Error(
        `Unsupported inverter manufacturer "${identity.manufacturer}"; expected to include "${expectedMn}".`
      );
    }
    if (expectedMd && !identity.model.toLowerCase().includes(expectedMd.toLowerCase())) {
      throw new Error(
        `Unsupported inverter model "${identity.model}"; expected to include "${expectedMd}".`
      );
    }
    if (!identity.manufacturer && !identity.model) {
      throw new Error("Inverter Common Model identity registers empty — refusing unsupported unit.");
    }
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
