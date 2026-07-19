import type { AssetType, DataSourceType, MeasurementUnit } from "@prisma/client";

export type TelemetryKeyDefinition = {
  key: string;
  displayName: string;
  unit: MeasurementUnit;
  dataType: "number" | "string" | "boolean";
  sourceType: DataSourceType;
  minimumValidValue?: number;
  maximumValidValue?: number;
  writable: boolean;
  critical: boolean;
};

/** Canonical telemetry keys — units are explicit in the key name where practical. */
export const TELEMETRY_KEYS = {
  // Electrical
  voltage_l1_v: { key: "voltage_l1_v", displayName: "Voltage L1", unit: "V", dataType: "number", sourceType: "measured", minimumValidValue: 0, maximumValidValue: 1000, writable: false, critical: true },
  voltage_l2_v: { key: "voltage_l2_v", displayName: "Voltage L2", unit: "V", dataType: "number", sourceType: "measured", minimumValidValue: 0, maximumValidValue: 1000, writable: false, critical: true },
  voltage_l3_v: { key: "voltage_l3_v", displayName: "Voltage L3", unit: "V", dataType: "number", sourceType: "measured", minimumValidValue: 0, maximumValidValue: 1000, writable: false, critical: true },
  current_l1_a: { key: "current_l1_a", displayName: "Current L1", unit: "A", dataType: "number", sourceType: "measured", minimumValidValue: 0, maximumValidValue: 5000, writable: false, critical: true },
  current_l2_a: { key: "current_l2_a", displayName: "Current L2", unit: "A", dataType: "number", sourceType: "measured", minimumValidValue: 0, maximumValidValue: 5000, writable: false, critical: true },
  current_l3_a: { key: "current_l3_a", displayName: "Current L3", unit: "A", dataType: "number", sourceType: "measured", minimumValidValue: 0, maximumValidValue: 5000, writable: false, critical: true },
  active_power_kw: { key: "active_power_kw", displayName: "Active power", unit: "kW", dataType: "number", sourceType: "measured", minimumValidValue: -50000, maximumValidValue: 50000, writable: false, critical: true },
  reactive_power_kvar: { key: "reactive_power_kvar", displayName: "Reactive power", unit: "kVAr", dataType: "number", sourceType: "measured", minimumValidValue: -50000, maximumValidValue: 50000, writable: false, critical: false },
  apparent_power_kva: { key: "apparent_power_kva", displayName: "Apparent power", unit: "kVA", dataType: "number", sourceType: "measured", minimumValidValue: 0, maximumValidValue: 50000, writable: false, critical: false },
  power_factor: { key: "power_factor", displayName: "Power factor", unit: "percent", dataType: "number", sourceType: "measured", minimumValidValue: -1, maximumValidValue: 1, writable: false, critical: false },
  frequency_hz: { key: "frequency_hz", displayName: "Frequency", unit: "Hz", dataType: "number", sourceType: "measured", minimumValidValue: 45, maximumValidValue: 65, writable: false, critical: true },
  energy_import_kwh_total: { key: "energy_import_kwh_total", displayName: "Energy import total", unit: "kWh", dataType: "number", sourceType: "measured", minimumValidValue: 0, writable: false, critical: false },
  energy_export_kwh_total: { key: "energy_export_kwh_total", displayName: "Energy export total", unit: "kWh", dataType: "number", sourceType: "measured", minimumValidValue: 0, writable: false, critical: false },
  // Solar / PPC
  inverter_active_power_kw: { key: "inverter_active_power_kw", displayName: "Inverter active power", unit: "kW", dataType: "number", sourceType: "measured", minimumValidValue: 0, maximumValidValue: 10000, writable: false, critical: true },
  inverter_available_power_kw: { key: "inverter_available_power_kw", displayName: "Inverter available power", unit: "kW", dataType: "number", sourceType: "measured", minimumValidValue: 0, maximumValidValue: 10000, writable: false, critical: true },
  inverter_limit_kw: { key: "inverter_limit_kw", displayName: "Inverter limit", unit: "kW", dataType: "number", sourceType: "measured", minimumValidValue: 0, maximumValidValue: 10000, writable: false, critical: false },
  ppc_active_power_setpoint_kw: { key: "ppc_active_power_setpoint_kw", displayName: "PPC active power setpoint", unit: "kW", dataType: "number", sourceType: "measured", minimumValidValue: 0, maximumValidValue: 100000, writable: true, critical: true },
  grid_export_limit_kw: { key: "grid_export_limit_kw", displayName: "Grid export limit", unit: "kW", dataType: "number", sourceType: "measured", minimumValidValue: 0, maximumValidValue: 100000, writable: false, critical: true },
  grid_export_power_kw: { key: "grid_export_power_kw", displayName: "Grid export power", unit: "kW", dataType: "number", sourceType: "measured", minimumValidValue: -100000, maximumValidValue: 100000, writable: false, critical: true },
  irradiance_wm2: { key: "irradiance_wm2", displayName: "Irradiance", unit: "wm2", dataType: "number", sourceType: "measured", minimumValidValue: 0, maximumValidValue: 1500, writable: false, critical: false },
  module_temperature_c: { key: "module_temperature_c", displayName: "Module temperature", unit: "celsius", dataType: "number", sourceType: "measured", minimumValidValue: -40, maximumValidValue: 120, writable: false, critical: false },
  ambient_temperature_c: { key: "ambient_temperature_c", displayName: "Ambient temperature", unit: "celsius", dataType: "number", sourceType: "measured", minimumValidValue: -40, maximumValidValue: 80, writable: false, critical: false },
  inverter_temperature_c: { key: "inverter_temperature_c", displayName: "Inverter temperature", unit: "celsius", dataType: "number", sourceType: "measured", minimumValidValue: -40, maximumValidValue: 120, writable: false, critical: false },
  inverter_status: { key: "inverter_status", displayName: "Inverter status", unit: "percent", dataType: "string", sourceType: "measured", writable: false, critical: true },
  inverter_fault_code: { key: "inverter_fault_code", displayName: "Inverter fault code", unit: "percent", dataType: "string", sourceType: "measured", writable: false, critical: true },
  // BESS
  state_of_charge_percent: { key: "state_of_charge_percent", displayName: "State of charge", unit: "percent", dataType: "number", sourceType: "measured", minimumValidValue: 0, maximumValidValue: 100, writable: false, critical: true },
  state_of_health_percent: { key: "state_of_health_percent", displayName: "State of health", unit: "percent", dataType: "number", sourceType: "measured", minimumValidValue: 0, maximumValidValue: 100, writable: false, critical: false },
  available_charge_power_kw: { key: "available_charge_power_kw", displayName: "Available charge power", unit: "kW", dataType: "number", sourceType: "measured", minimumValidValue: 0, maximumValidValue: 50000, writable: false, critical: true },
  available_discharge_power_kw: { key: "available_discharge_power_kw", displayName: "Available discharge power", unit: "kW", dataType: "number", sourceType: "measured", minimumValidValue: 0, maximumValidValue: 50000, writable: false, critical: true },
  battery_temperature_c: { key: "battery_temperature_c", displayName: "Battery temperature", unit: "celsius", dataType: "number", sourceType: "measured", minimumValidValue: -40, maximumValidValue: 80, writable: false, critical: true },
  charge_power_kw: { key: "charge_power_kw", displayName: "Charge power", unit: "kW", dataType: "number", sourceType: "measured", minimumValidValue: 0, maximumValidValue: 50000, writable: false, critical: true },
  discharge_power_kw: { key: "discharge_power_kw", displayName: "Discharge power", unit: "kW", dataType: "number", sourceType: "measured", minimumValidValue: 0, maximumValidValue: 50000, writable: false, critical: true },
  cycle_count: { key: "cycle_count", displayName: "Cycle count", unit: "percent", dataType: "number", sourceType: "measured", minimumValidValue: 0, writable: false, critical: false },
  bms_alarm_state: { key: "bms_alarm_state", displayName: "BMS alarm state", unit: "percent", dataType: "string", sourceType: "measured", writable: false, critical: true },
  // Electrolyser
  load_power_kw: { key: "load_power_kw", displayName: "Electrolyser load power", unit: "kW", dataType: "number", sourceType: "measured", minimumValidValue: 0, maximumValidValue: 100000, writable: false, critical: true },
  minimum_load_kw: { key: "minimum_load_kw", displayName: "Minimum load", unit: "kW", dataType: "number", sourceType: "operator_entered", minimumValidValue: 0, writable: false, critical: false },
  maximum_load_kw: { key: "maximum_load_kw", displayName: "Maximum load", unit: "kW", dataType: "number", sourceType: "operator_entered", minimumValidValue: 0, writable: false, critical: false },
  production_kg_per_hour: { key: "production_kg_per_hour", displayName: "H2 production rate", unit: "kg_per_hour", dataType: "number", sourceType: "measured", minimumValidValue: 0, maximumValidValue: 10000, writable: false, critical: true },
  storage_level_kg: { key: "storage_level_kg", displayName: "H2 storage level", unit: "kg", dataType: "number", sourceType: "measured", minimumValidValue: 0, writable: false, critical: true },
  water_flow_litre_per_hour: { key: "water_flow_litre_per_hour", displayName: "Water flow", unit: "litre_per_hour", dataType: "number", sourceType: "measured", minimumValidValue: 0, writable: false, critical: false },
  stack_temperature_c: { key: "stack_temperature_c", displayName: "Stack temperature", unit: "celsius", dataType: "number", sourceType: "measured", minimumValidValue: -20, maximumValidValue: 120, writable: false, critical: true },
  efficiency_kwh_per_kg: { key: "efficiency_kwh_per_kg", displayName: "Efficiency", unit: "kWh", dataType: "number", sourceType: "calculated", minimumValidValue: 0, maximumValidValue: 200, writable: false, critical: false },
  operating_mode: { key: "operating_mode", displayName: "Operating mode", unit: "percent", dataType: "string", sourceType: "measured", writable: false, critical: false },
  alarm_state: { key: "alarm_state", displayName: "Alarm state", unit: "percent", dataType: "string", sourceType: "measured", writable: false, critical: true }
} as const satisfies Record<string, TelemetryKeyDefinition>;

export type TelemetryKey = keyof typeof TELEMETRY_KEYS;

export const TELEMETRY_KEYS_BY_ASSET_TYPE: Partial<Record<AssetType, TelemetryKey[]>> = {
  revenue_meter: [
    "voltage_l1_v",
    "voltage_l2_v",
    "voltage_l3_v",
    "current_l1_a",
    "current_l2_a",
    "current_l3_a",
    "active_power_kw",
    "reactive_power_kvar",
    "apparent_power_kva",
    "power_factor",
    "frequency_hz",
    "energy_import_kwh_total",
    "energy_export_kwh_total"
  ],
  inverter: [
    "inverter_active_power_kw",
    "inverter_available_power_kw",
    "inverter_limit_kw",
    "inverter_temperature_c",
    "inverter_status",
    "inverter_fault_code",
    "active_power_kw",
    "frequency_hz"
  ],
  plant_power_controller: [
    "ppc_active_power_setpoint_kw",
    "grid_export_limit_kw",
    "grid_export_power_kw",
    "active_power_kw"
  ],
  weather_station: ["irradiance_wm2", "ambient_temperature_c", "module_temperature_c"],
  solar_array: ["irradiance_wm2", "module_temperature_c"],
  bess: [
    "state_of_charge_percent",
    "state_of_health_percent",
    "available_charge_power_kw",
    "available_discharge_power_kw",
    "battery_temperature_c",
    "charge_power_kw",
    "discharge_power_kw",
    "cycle_count",
    "bms_alarm_state"
  ],
  battery_management_system: ["state_of_charge_percent", "state_of_health_percent", "bms_alarm_state", "battery_temperature_c"],
  electrolyser: [
    "load_power_kw",
    "minimum_load_kw",
    "maximum_load_kw",
    "production_kg_per_hour",
    "storage_level_kg",
    "water_flow_litre_per_hour",
    "stack_temperature_c",
    "efficiency_kwh_per_kg",
    "operating_mode",
    "alarm_state"
  ],
  hydrogen_storage: ["storage_level_kg"],
  grid_connection: ["grid_export_power_kw", "grid_export_limit_kw", "frequency_hz", "active_power_kw"]
};

export const isKnownTelemetryKey = (key: string): key is TelemetryKey =>
  Object.prototype.hasOwnProperty.call(TELEMETRY_KEYS, key);

export const getTelemetryKeyDefinition = (key: string): TelemetryKeyDefinition | null =>
  isKnownTelemetryKey(key) ? TELEMETRY_KEYS[key] : null;
