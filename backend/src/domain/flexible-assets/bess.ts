import type { DataSourceType } from "../provenance.js";
import { provenanced, type ProvenancedValue } from "./provenance-value.js";

/** Static / configured BESS parameters (not live plant state). */
export type BessConfiguration = {
  assetId: string;
  ratedPowerKw: ProvenancedValue<number>;
  ratedEnergyKwh: ProvenancedValue<number>;
  minSocPercent: ProvenancedValue<number>;
  maxSocPercent: ProvenancedValue<number>;
  chargeEfficiency: ProvenancedValue<number>;
  dischargeEfficiency: ProvenancedValue<number>;
  maxChargePowerKw: ProvenancedValue<number>;
  maxDischargePowerKw: ProvenancedValue<number>;
  rampLimitKwPerMin: ProvenancedValue<number>;
  degradationCostZarPerMwh: ProvenancedValue<number>;
  reserveSocPercent: ProvenancedValue<number>;
  minOperatingTempC: ProvenancedValue<number | null>;
  maxOperatingTempC: ProvenancedValue<number | null>;
  warrantyCycleLimit: ProvenancedValue<number | null>;
  simulationMode: boolean;
  configSource: DataSourceType;
};

/** Live or simulated operating state. Never invent measured values. */
export type BessState = {
  assetId: string;
  socPercent: ProvenancedValue<number>;
  temperatureC: ProvenancedValue<number | null>;
  chargePowerKw: ProvenancedValue<number>;
  dischargePowerKw: ProvenancedValue<number>;
  availableChargePowerKw: ProvenancedValue<number | null>;
  availableDischargePowerKw: ProvenancedValue<number | null>;
  cycleCount: ProvenancedValue<number | null>;
  alarmState: ProvenancedValue<string | null>;
  operatingState: ProvenancedValue<string>;
  simulationMode: boolean;
};

export const defaultBessConfiguration = (assetId: string): BessConfiguration => ({
  assetId,
  ratedPowerKw: provenanced(2000, "operator_entered"),
  ratedEnergyKwh: provenanced(4000, "operator_entered"),
  minSocPercent: provenanced(10, "operator_entered"),
  maxSocPercent: provenanced(90, "operator_entered"),
  chargeEfficiency: provenanced(0.95, "operator_entered"),
  dischargeEfficiency: provenanced(0.95, "operator_entered"),
  maxChargePowerKw: provenanced(2000, "operator_entered"),
  maxDischargePowerKw: provenanced(2000, "operator_entered"),
  rampLimitKwPerMin: provenanced(500, "operator_entered"),
  degradationCostZarPerMwh: provenanced(120, "estimated"),
  reserveSocPercent: provenanced(15, "operator_entered"),
  minOperatingTempC: provenanced(5, "operator_entered"),
  maxOperatingTempC: provenanced(45, "operator_entered"),
  warrantyCycleLimit: provenanced(6000, "imported"),
  simulationMode: true,
  configSource: "operator_entered"
});

export const defaultSimulatedBessState = (
  assetId: string,
  socPercent = 55
): BessState => ({
  assetId,
  socPercent: provenanced(socPercent, "simulated", "unverified", {
    note: "Simulated SOC ΓÇö not measured BMS telemetry"
  }),
  temperatureC: provenanced(28, "simulated", "unverified"),
  chargePowerKw: provenanced(0, "simulated", "unverified"),
  dischargePowerKw: provenanced(0, "simulated", "unverified"),
  availableChargePowerKw: provenanced(1800, "simulated", "unverified"),
  availableDischargePowerKw: provenanced(1800, "simulated", "unverified"),
  cycleCount: provenanced(120, "simulated", "unverified"),
  alarmState: provenanced(null, "simulated", "unverified"),
  operatingState: provenanced("idle", "simulated", "unverified"),
  simulationMode: true
});
