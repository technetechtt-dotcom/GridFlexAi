/**
 * Vendor-neutral industrial protocol adapter interfaces.
 * Do not invent real vendor register addresses — supply maps via configuration.
 */

import type { DataQuality, DataSourceType } from "../domain/provenance.js";

export type GatewayProtocol =
  | "modbus_rtu"
  | "modbus_tcp"
  | "sunspec_modbus"
  | "opc_ua"
  | "mqtt"
  | "rest"
  | "iec_61850"
  | "iec_60870_5_104"
  | "dnp3";

export type GatewayPointAccess = "read" | "write" | "read_write";

export type RegisterMapPoint = {
  key: string;
  /** Protocol address / node id — must come from a labelled map file, never invented inline. */
  address: string;
  dataType: "bool" | "int16" | "uint16" | "int32" | "uint32" | "float32" | "string";
  unit?: string;
  access: GatewayPointAccess;
  scale?: number;
  description?: string;
};

export type RegisterMapDocument = {
  /** Must be true for non-production / example maps. */
  fictitious: boolean;
  label: string;
  vendor: string;
  model: string;
  protocol: GatewayProtocol;
  schemaVersion: string;
  points: RegisterMapPoint[];
};

export type GatewayConnectionConfig = {
  protocol: GatewayProtocol;
  endpoint: string;
  timeoutMs: number;
  retries: number;
  readOnly: boolean;
  /** When false (default), write/command paths throw. */
  physicalCommandExecutionEnabled: boolean;
  pollingIntervalMs?: number;
};

export type GatewayReadResult = {
  key: string;
  value: number | string | boolean | null;
  quality: DataQuality;
  sourceType: DataSourceType;
  deviceTimestamp: string;
  raw?: unknown;
};

export type GatewayWriteResult = {
  key: string;
  accepted: boolean;
  acknowledged: boolean;
  readBack?: GatewayReadResult;
  raw?: unknown;
};

export type CircuitBreakerState = "closed" | "open" | "half_open";

export interface ProtocolAdapter {
  readonly protocol: GatewayProtocol;
  connect(config: GatewayConnectionConfig): Promise<void>;
  disconnect(): Promise<void>;
  readPoints(keys: string[]): Promise<GatewayReadResult[]>;
  writePoint(key: string, value: number | string | boolean): Promise<GatewayWriteResult>;
  health(): Promise<{ ok: boolean; breaker: CircuitBreakerState; detail?: string }>;
}

export type StoreAndForwardItem = {
  id: string;
  enqueuedAt: string;
  payload: unknown;
  attempts: number;
};

export interface DurableQueue {
  enqueue(item: Omit<StoreAndForwardItem, "id" | "enqueuedAt" | "attempts"> & { id?: string }): Promise<StoreAndForwardItem>;
  peek(limit: number): Promise<StoreAndForwardItem[]>;
  ack(id: string): Promise<void>;
  depth(): Promise<number>;
}

export class InMemoryDurableQueue implements DurableQueue {
  private items: StoreAndForwardItem[] = [];

  async enqueue(
    item: Omit<StoreAndForwardItem, "id" | "enqueuedAt" | "attempts"> & { id?: string }
  ): Promise<StoreAndForwardItem> {
    const next: StoreAndForwardItem = {
      id: item.id ?? `q-${this.items.length + 1}`,
      enqueuedAt: new Date().toISOString(),
      payload: item.payload,
      attempts: 0
    };
    this.items.push(next);
    return next;
  }

  async peek(limit: number): Promise<StoreAndForwardItem[]> {
    return this.items.slice(0, limit);
  }

  async ack(id: string): Promise<void> {
    this.items = this.items.filter((item) => item.id !== id);
  }

  async depth(): Promise<number> {
    return this.items.length;
  }
}

export class SimpleCircuitBreaker {
  private failures = 0;
  private openedAt: number | null = null;
  state: CircuitBreakerState = "closed";

  constructor(
    private readonly failureThreshold = 3,
    private readonly openMs = 30_000
  ) {}

  recordSuccess(): void {
    this.failures = 0;
    this.state = "closed";
    this.openedAt = null;
  }

  recordFailure(): void {
    this.failures += 1;
    if (this.failures >= this.failureThreshold) {
      this.state = "open";
      this.openedAt = Date.now();
    }
  }

  allow(): boolean {
    if (this.state !== "open") return true;
    if (this.openedAt !== null && Date.now() - this.openedAt >= this.openMs) {
      this.state = "half_open";
      return true;
    }
    return false;
  }
}

export const assertWriteAllowed = (config: GatewayConnectionConfig): void => {
  if (config.readOnly) {
    throw new Error("Gateway is in read-only mode; writes are rejected.");
  }
  if (!config.physicalCommandExecutionEnabled) {
    throw new Error(
      "Physical command execution is disabled. Set physicalCommandExecutionEnabled only after HIL validation."
    );
  }
};

export const mapQualityFromFreshness = (
  ageMs: number,
  staleAfterMs: number
): DataQuality => {
  if (ageMs < 0) return "invalid";
  if (ageMs <= staleAfterMs) return "valid";
  if (ageMs <= staleAfterMs * 3) return "uncertain";
  return "stale";
};
