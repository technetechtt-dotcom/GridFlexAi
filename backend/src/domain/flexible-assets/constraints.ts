import type { BessConfiguration, BessState } from "./bess.js";
import type { ElectrolyserConfiguration, ElectrolyserState } from "./electrolyser.js";

export type ConstraintSeverity = "hard" | "soft";

export type ConstraintViolation = {
  code: string;
  field: string;
  message: string;
  severity: ConstraintSeverity;
};

export const hasBlockingViolations = (violations: ConstraintViolation[]): boolean =>
  violations.some((v) => v.severity === "hard");

const hard = (code: string, field: string, message: string): ConstraintViolation => ({
  code,
  field,
  message,
  severity: "hard"
});

const soft = (code: string, field: string, message: string): ConstraintViolation => ({
  code,
  field,
  message,
  severity: "soft"
});

export const validateBessConfiguration = (config: BessConfiguration): ConstraintViolation[] => {
  const violations: ConstraintViolation[] = [];

  if (config.minSocPercent.value >= config.maxSocPercent.value) {
    violations.push(
      hard("bess.soc_order", "minSocPercent", "minSocPercent must be strictly less than maxSocPercent")
    );
  }

  if (config.reserveSocPercent.value < config.minSocPercent.value) {
    violations.push(
      soft(
        "bess.reserve_below_min",
        "reserveSocPercent",
        "reserveSocPercent is below minSocPercent; reserve may be unreachable"
      )
    );
  }

  if (config.reserveSocPercent.value > config.maxSocPercent.value) {
    violations.push(
      hard("bess.reserve_above_max", "reserveSocPercent", "reserveSocPercent cannot exceed maxSocPercent")
    );
  }

  if (config.ratedPowerKw.value <= 0 || config.ratedEnergyKwh.value <= 0) {
    violations.push(hard("bess.capacity", "ratedPowerKw", "Rated power and energy must be positive"));
  }

  if (config.maxChargePowerKw.value <= 0 || config.maxDischargePowerKw.value <= 0) {
    violations.push(
      hard("bess.power_limits", "maxChargePowerKw", "Charge and discharge power limits must be positive")
    );
  }

  if (
    config.chargeEfficiency.value <= 0 ||
    config.chargeEfficiency.value > 1 ||
    config.dischargeEfficiency.value <= 0 ||
    config.dischargeEfficiency.value > 1
  ) {
    violations.push(
      hard("bess.efficiency", "chargeEfficiency", "Charge/discharge efficiency must be in (0, 1]")
    );
  }

  if (
    config.minOperatingTempC.value !== null &&
    config.maxOperatingTempC.value !== null &&
    config.minOperatingTempC.value > config.maxOperatingTempC.value
  ) {
    violations.push(
      hard("bess.temp_order", "minOperatingTempC", "minOperatingTempC must be <= maxOperatingTempC")
    );
  }

  return violations;
};

export const validateBessStateAgainstConfig = (
  config: BessConfiguration,
  state: BessState
): ConstraintViolation[] => {
  const violations: ConstraintViolation[] = [];

  if (state.chargePowerKw.value > 0 && state.dischargePowerKw.value > 0) {
    violations.push(
      hard(
        "bess.state.simultaneous",
        "chargePowerKw",
        "BESS cannot charge and discharge simultaneously"
      )
    );
  }

  if (state.socPercent.value < config.minSocPercent.value - 1e-6) {
    violations.push(hard("bess.state.soc_low", "socPercent", "SOC is below configured minimum"));
  }

  if (state.socPercent.value > config.maxSocPercent.value + 1e-6) {
    violations.push(hard("bess.state.soc_high", "socPercent", "SOC is above configured maximum"));
  }

  if (state.chargePowerKw.value > config.maxChargePowerKw.value + 1e-6) {
    violations.push(hard("bess.state.charge_limit", "chargePowerKw", "Charge power exceeds maxChargePowerKw"));
  }

  if (state.dischargePowerKw.value > config.maxDischargePowerKw.value + 1e-6) {
    violations.push(
      hard("bess.state.discharge_limit", "dischargePowerKw", "Discharge power exceeds maxDischargePowerKw")
    );
  }

  return violations;
};

export const validateElectrolyserConfiguration = (
  config: ElectrolyserConfiguration
): ConstraintViolation[] => {
  const violations: ConstraintViolation[] = [];

  if (config.minStableLoadKw.value < 0 || config.maxLoadKw.value <= 0) {
    violations.push(hard("ely.load_limits", "maxLoadKw", "Load limits must be non-negative / positive"));
  }

  if (config.minStableLoadKw.value > config.maxLoadKw.value) {
    violations.push(
      hard("ely.load_order", "minStableLoadKw", "minStableLoadKw must be <= maxLoadKw")
    );
  }

  if (config.efficiencyKwhPerKg.value <= 0) {
    violations.push(hard("ely.efficiency", "efficiencyKwhPerKg", "efficiencyKwhPerKg must be positive"));
  }

  if (config.hydrogenStorageCapacityKg.value <= 0) {
    violations.push(
      hard("ely.storage", "hydrogenStorageCapacityKg", "Hydrogen storage capacity must be positive")
    );
  }

  if (
    config.minOperatingTempC.value !== null &&
    config.maxOperatingTempC.value !== null &&
    config.minOperatingTempC.value > config.maxOperatingTempC.value
  ) {
    violations.push(
      hard("ely.temp_order", "minOperatingTempC", "minOperatingTempC must be <= maxOperatingTempC")
    );
  }

  return violations;
};

export const validateElectrolyserStateAgainstConfig = (
  config: ElectrolyserConfiguration,
  state: ElectrolyserState
): ConstraintViolation[] => {
  const violations: ConstraintViolation[] = [];
  const load = state.loadPowerKw.value;

  if (load > 0 && load + 1e-6 < config.minStableLoadKw.value) {
    violations.push(
      hard(
        "ely.state.min_stable",
        "loadPowerKw",
        "Non-zero electrolyser load is below minimum stable load"
      )
    );
  }

  if (load > config.maxLoadKw.value + 1e-6) {
    violations.push(hard("ely.state.max_load", "loadPowerKw", "Electrolyser load exceeds maxLoadKw"));
  }

  if (config.maintenanceWindowActive.value && load > 0) {
    violations.push(
      hard("ely.state.maintenance", "loadPowerKw", "Electrolyser must not be loaded during maintenance")
    );
  }

  if (state.storageLevelKg.value > config.hydrogenStorageCapacityKg.value + 1e-6) {
    violations.push(
      hard("ely.state.storage_full", "storageLevelKg", "Hydrogen storage level exceeds capacity")
    );
  }

  return violations;
};
