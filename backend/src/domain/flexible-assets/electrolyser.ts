import type { DataSourceType } from "../provenance.js";
import { provenanced, type ProvenancedValue } from "./provenance-value.js";

export const ELECTROLYSER_TECHNOLOGIES = [
  "alkaline",
  "pem",
  "soec",
  "aem",
  "unspecified"
] as const;

export type ElectrolyserTechnology = (typeof ELECTROLYSER_TECHNOLOGIES)[number];

export type ElectrolyserConfiguration = {
  assetId: string;
  technology: ProvenancedValue<ElectrolyserTechnology>;
  minStableLoadKw: ProvenancedValue<number>;
  maxLoadKw: ProvenancedValue<number>;
  rampRateKwPerMin: ProvenancedValue<number>;
  startUpTimeMin: ProvenancedValue<number>;
  shutDownTimeMin: ProvenancedValue<number>;
  minRunTimeMin: ProvenancedValue<number>;
  efficiencyKwhPerKg: ProvenancedValue<number>;
  waterLitresPerKg: ProvenancedValue<number>;
  hydrogenStorageCapacityKg: ProvenancedValue<number>;
  hydrogenSalePriceZarPerKg: ProvenancedValue<number>;
  operatingCostZarPerHour: ProvenancedValue<number>;
  minOperatingTempC: ProvenancedValue<number | null>;
  maxOperatingTempC: ProvenancedValue<number | null>;
  maintenanceWindowActive: ProvenancedValue<boolean>;
  simulationMode: boolean;
  configSource: DataSourceType;
};

export type ElectrolyserState = {
  assetId: string;
  loadPowerKw: ProvenancedValue<number>;
  productionKgPerHour: ProvenancedValue<number>;
  storageLevelKg: ProvenancedValue<number>;
  waterFlowLitrePerHour: ProvenancedValue<number | null>;
  stackTemperatureC: ProvenancedValue<number | null>;
  operatingMode: ProvenancedValue<string>;
  alarmState: ProvenancedValue<string | null>;
  runTimeMinutes: ProvenancedValue<number>;
  simulationMode: boolean;
};

export const defaultElectrolyserConfiguration = (
  assetId: string
): ElectrolyserConfiguration => ({
  assetId,
  technology: provenanced("alkaline", "operator_entered"),
  minStableLoadKw: provenanced(200, "operator_entered"),
  maxLoadKw: provenanced(5000, "operator_entered"),
  rampRateKwPerMin: provenanced(250, "operator_entered"),
  startUpTimeMin: provenanced(15, "operator_entered"),
  shutDownTimeMin: provenanced(10, "operator_entered"),
  minRunTimeMin: provenanced(30, "operator_entered"),
  efficiencyKwhPerKg: provenanced(52, "estimated"),
  waterLitresPerKg: provenanced(10, "estimated"),
  hydrogenStorageCapacityKg: provenanced(2000, "operator_entered"),
  hydrogenSalePriceZarPerKg: provenanced(85, "operator_entered"),
  operatingCostZarPerHour: provenanced(400, "estimated"),
  minOperatingTempC: provenanced(20, "operator_entered"),
  maxOperatingTempC: provenanced(90, "operator_entered"),
  maintenanceWindowActive: provenanced(false, "operator_entered"),
  simulationMode: true,
  configSource: "operator_entered"
});

export const defaultSimulatedElectrolyserState = (
  assetId: string
): ElectrolyserState => ({
  assetId,
  loadPowerKw: provenanced(0, "simulated", "unverified", {
    note: "Simulated load ΓÇö not measured plant telemetry"
  }),
  productionKgPerHour: provenanced(0, "simulated", "unverified"),
  storageLevelKg: provenanced(400, "simulated", "unverified"),
  waterFlowLitrePerHour: provenanced(0, "simulated", "unverified"),
  stackTemperatureC: provenanced(65, "simulated", "unverified"),
  operatingMode: provenanced("standby", "simulated", "unverified"),
  alarmState: provenanced(null, "simulated", "unverified"),
  runTimeMinutes: provenanced(0, "simulated", "unverified"),
  simulationMode: true
});
