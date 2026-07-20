/**
 * Verified inverter integration types.
 * Register addresses must come from an official manufacturer / installer map —
 * never invent or copy from fictitious examples.
 */

export type ModbusWordOrder = "ABCD" | "CDAB" | "BADC" | "DCBA";

export type RegisterDataType = "uint16" | "int16" | "uint32" | "int32";

/** Pilot read-only register definition (no write access). */
export type RegisterDefinition = {
  key: string;
  /** Holding/input register address (0-based or vendor-documented; see map addressingMode). */
  address: number;
  length: number;
  dataType: RegisterDataType;
  wordOrder: ModbusWordOrder;
  /**
   * Fixed engineering scale when `scaleMode` is `fixed` (default).
   * Ignored when `scaleMode` is `sunssf` and a live SF value is supplied.
   */
  scale: number;
  /** How to apply scale — SunSpec sunssf uses engineering = raw * 10^(sf). */
  scaleMode?: "fixed" | "sunssf";
  /** Key of another register that holds the sunssf value for this point. */
  scaleFactorKey?: string;
  unit: string;
  access: "read";
  min?: number;
  max?: number;
  /** Raw sentinel values that mean unavailable / N/A (before scale). */
  unavailableRaw?: number[];
  description?: string;
};

export type AddressingMode = "zero_based" | "one_based_holding";

export type EquipmentIdentity = {
  manufacturer: string;
  model: string;
  firmwareVersion: string;
  communicationModule: string;
  transport: "modbus_tcp" | "modbus_rtu";
  /** Official register-map document version / revision from the vendor PDF. */
  registerMapVersion: string;
  /** Path or ticket ID for the official PDF / NDA package. */
  registerMapSource: string;
  baudRate?: number | undefined;
  parity?: "none" | "even" | "odd" | undefined;
  stopBits?: 1 | 2 | undefined;
  slaveId: number;
  /** How signed/unsigned and word order are defined in the vendor document. */
  signednessNotes: string;
  byteOrderNotes: string;
};

export type VerifiedInverterMap = {
  /** Must be false for production pilot maps. */
  fictitious: false;
  /** Attestation that addresses were transcribed from the official map (not guessed). */
  provenanceAttested: true;
  equipment: EquipmentIdentity;
  addressingMode: AddressingMode;
  schemaVersion: string;
  /** Directory / file version key: vendor/model/firmware. */
  mapPath: string;
  /** Pilot read set — active/reactive power, V, I, f, energy, state, faults, temperature. */
  registers: RegisterDefinition[];
};

export type DecodedRegisterValue = {
  key: string;
  engineeringValue: number | null;
  unit: string;
  quality: "good" | "uncertain" | "bad" | "stale";
  sourceType: "measured";
  rawRegisters: number[];
  rawDecoded: number | null;
  unavailable: boolean;
  rangeViolation: boolean;
  measuredAt: string;
  receivedAt: string;
  calibrationVersion?: string;
};

export type CommunicationHealthMetrics = {
  connected: boolean;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  consecutiveFailures: number;
  totalReads: number;
  totalFailures: number;
  averageLatencyMs: number | null;
  reconnectAttempts: number;
  circuitBreaker: "closed" | "open" | "half_open";
  detail: string;
};

export const PILOT_INVERTER_READ_KEYS = [
  "active_power_kw",
  "reactive_power_kvar",
  "voltage_v",
  "current_a",
  "frequency_hz",
  "lifetime_energy_kwh",
  "inverter_state",
  "alarm_code",
  "temperature_c",
  /** Optional: prefer lifetime delta; Model 103 has no native daily WH point. */
  "daily_energy_kwh"
] as const;

export type PilotInverterReadKey = (typeof PILOT_INVERTER_READ_KEYS)[number];
