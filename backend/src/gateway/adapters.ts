import {
  assertWriteAllowed,
  SimpleCircuitBreaker,
  type GatewayConnectionConfig,
  type GatewayProtocol,
  type GatewayReadResult,
  type GatewayWriteResult,
  type ProtocolAdapter,
  type RegisterMapDocument
} from "./types.js";
import { assertProtocolMatches, parseRegisterMap } from "./register-map.js";

type SimulatedPointState = Record<string, number | string | boolean | null>;

/**
 * Base simulated adapter used by protocol-specific facades.
 * No real sockets are opened.
 */
export class SimulatedProtocolAdapter implements ProtocolAdapter {
  readonly protocol: GatewayProtocol;
  private config: GatewayConnectionConfig | null = null;
  private connected = false;
  private readonly breaker = new SimpleCircuitBreaker();
  private readonly state: SimulatedPointState = {};
  private readonly map: RegisterMapDocument;

  constructor(protocol: GatewayProtocol, registerMap: unknown) {
    this.protocol = protocol;
    this.map = parseRegisterMap(registerMap);
    assertProtocolMatches(this.map, protocol);
    if (!this.map.fictitious) {
      throw new Error("Simulated adapters only accept fictitious register maps.");
    }
    for (const point of this.map.points) {
      this.state[point.key] = 0;
    }
  }

  async connect(config: GatewayConnectionConfig): Promise<void> {
    if (config.protocol !== this.protocol) {
      throw new Error(`Config protocol ${config.protocol} != adapter ${this.protocol}`);
    }
    this.config = config;
    this.connected = true;
    this.breaker.recordSuccess();
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async readPoints(keys: string[]): Promise<GatewayReadResult[]> {
    this.assertConnected();
    if (!this.breaker.allow()) {
      throw new Error("Circuit breaker open");
    }
    const now = new Date().toISOString();
    return keys.map((key) => {
      if (!(key in this.state)) {
        throw new Error(`Unknown point key: ${key}`);
      }
      return {
        key,
        value: this.state[key] ?? null,
        quality: "valid" as const,
        sourceType: "simulated" as const,
        deviceTimestamp: now
      };
    });
  }

  async writePoint(key: string, value: number | string | boolean): Promise<GatewayWriteResult> {
    this.assertConnected();
    const config = this.config!;
    assertWriteAllowed(config);
    const point = this.map.points.find((p) => p.key === key);
    if (!point || point.access === "read") {
      throw new Error(`Point ${key} is not writable in register map.`);
    }
    this.state[key] = value;
    const [readBack] = await this.readPoints([key]);
    const result: GatewayWriteResult = {
      key,
      accepted: true,
      acknowledged: true
    };
    if (readBack) result.readBack = readBack;
    return result;
  }

  /** Test helper: mutate simulated process values without enabling writes. */
  seedPoint(key: string, value: number | string | boolean | null): void {
    if (!(key in this.state)) {
      throw new Error(`Unknown point key: ${key}`);
    }
    this.state[key] = value;
  }

  async health() {
    return {
      ok: this.connected && this.breaker.state !== "open",
      breaker: this.breaker.state,
      detail: this.connected ? "simulated-connected" : "disconnected"
    };
  }

  private assertConnected(): void {
    if (!this.connected || !this.config) {
      throw new Error("Adapter not connected");
    }
  }
}

export const createModbusRtuAdapter = (map: unknown) =>
  new SimulatedProtocolAdapter("modbus_rtu", map);
export const createModbusTcpAdapter = (map: unknown) =>
  new SimulatedProtocolAdapter("modbus_tcp", map);
export const createSunSpecAdapter = (map: unknown) =>
  new SimulatedProtocolAdapter("sunspec_modbus", map);
export const createOpcUaAdapter = (map: unknown) =>
  new SimulatedProtocolAdapter("opc_ua", map);
export const createMqttAdapter = (map: unknown) =>
  new SimulatedProtocolAdapter("mqtt", map);
export const createRestAdapter = (map: unknown) =>
  new SimulatedProtocolAdapter("rest", map);

/** IEC / DNP3 placeholders — interfaces only; no protocol stack. */
export class PlaceholderProtocolAdapter implements ProtocolAdapter {
  private connected = false;

  constructor(readonly protocol: GatewayProtocol) {
    if (!["iec_61850", "iec_60870_5_104", "dnp3"].includes(protocol)) {
      throw new Error(`Not a placeholder protocol: ${protocol}`);
    }
  }

  async connect(_config: GatewayConnectionConfig): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async readPoints(_keys: string[]): Promise<GatewayReadResult[]> {
    throw new Error(
      `${this.protocol} adapter is a placeholder. Supply a certified stack and vendor ICD/CID before use.`
    );
  }

  async writePoint(_key: string, _value: number | string | boolean): Promise<GatewayWriteResult> {
    throw new Error(
      `${this.protocol} write path is a placeholder and remains disabled until certified integration.`
    );
  }

  async health() {
    return {
      ok: false,
      breaker: "open" as const,
      detail: `${this.protocol} placeholder — not implemented`
    };
  }
}

export const createIec61850Placeholder = () => new PlaceholderProtocolAdapter("iec_61850");
export const createIec60870Placeholder = () => new PlaceholderProtocolAdapter("iec_60870_5_104");
export const createDnp3Placeholder = () => new PlaceholderProtocolAdapter("dnp3");
