import type { MeasurementUnit } from "./provenance.js";

const POWER_FACTORS_TO_KW: Record<"kW" | "MW", number> = {
  kW: 1,
  MW: 1000
};

const ENERGY_FACTORS_TO_KWH: Record<"kWh" | "MWh", number> = {
  kWh: 1,
  MWh: 1000
};

export class UnitConversionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnitConversionError";
  }
}

export const convertPower = (
  value: number,
  from: "kW" | "MW",
  to: "kW" | "MW"
): number => {
  if (!Number.isFinite(value)) {
    throw new UnitConversionError("Power value must be a finite number.");
  }
  const kilowatts = value * POWER_FACTORS_TO_KW[from];
  return kilowatts / POWER_FACTORS_TO_KW[to];
};

export const convertEnergy = (
  value: number,
  from: "kWh" | "MWh",
  to: "kWh" | "MWh"
): number => {
  if (!Number.isFinite(value)) {
    throw new UnitConversionError("Energy value must be a finite number.");
  }
  const kilowattHours = value * ENERGY_FACTORS_TO_KWH[from];
  return kilowattHours / ENERGY_FACTORS_TO_KWH[to];
};

export const assertCompatibleUnit = (
  actual: MeasurementUnit,
  expected: MeasurementUnit
): void => {
  if (actual !== expected) {
    throw new UnitConversionError(`Expected unit ${expected} but received ${actual}.`);
  }
};

/** Never silently mix kW and MW — callers must convert explicitly. */
export const formatPowerKw = (valueKw: number, digits = 2): string => {
  if (!Number.isFinite(valueKw)) {
    return "—";
  }
  return `${valueKw.toFixed(digits)} kW`;
};

export const formatEnergyKwh = (valueKwh: number, digits = 2): string => {
  if (!Number.isFinite(valueKwh)) {
    return "—";
  }
  return `${valueKwh.toFixed(digits)} kWh`;
};

export type FreshnessResult = {
  ageSeconds: number;
  isStale: boolean;
  isOffline: boolean;
  qualityHint: "valid" | "stale" | "missing";
};

export const calculateDataFreshness = (
  sourceTimestamp: Date | null | undefined,
  options: { staleAfterSeconds?: number; offlineAfterSeconds?: number; now?: Date } = {}
): FreshnessResult => {
  const staleAfterSeconds = options.staleAfterSeconds ?? 120;
  const offlineAfterSeconds = options.offlineAfterSeconds ?? 600;
  const now = options.now ?? new Date();

  if (!sourceTimestamp) {
    return {
      ageSeconds: Number.POSITIVE_INFINITY,
      isStale: true,
      isOffline: true,
      qualityHint: "missing"
    };
  }

  const ageSeconds = Math.max(0, (now.getTime() - sourceTimestamp.getTime()) / 1000);
  if (ageSeconds >= offlineAfterSeconds) {
    return { ageSeconds, isStale: true, isOffline: true, qualityHint: "stale" };
  }
  if (ageSeconds >= staleAfterSeconds) {
    return { ageSeconds, isStale: true, isOffline: false, qualityHint: "stale" };
  }
  return { ageSeconds, isStale: false, isOffline: false, qualityHint: "valid" };
};
