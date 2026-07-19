/**
 * Shared data provenance, quality and unit vocabulary for GridFlex AI.
 * These values must stay aligned between API, DB enums and UI badges.
 */

export const DATA_SOURCE_TYPES = [
  "measured",
  "calculated",
  "forecast",
  "estimated",
  "simulated",
  "operator_entered",
  "imported"
] as const;

export type DataSourceType = (typeof DATA_SOURCE_TYPES)[number];

export const DATA_QUALITIES = [
  "valid",
  "uncertain",
  "stale",
  "missing",
  "invalid",
  "substituted",
  "unverified"
] as const;

export type DataQuality = (typeof DATA_QUALITIES)[number];

export const MEASUREMENT_UNITS = [
  "V",
  "A",
  "Hz",
  "kW",
  "MW",
  "kWh",
  "MWh",
  "kVAr",
  "MVAr",
  "kVA",
  "MVA",
  "percent",
  "celsius",
  "wm2",
  "kg",
  "kg_per_hour",
  "litre",
  "litre_per_hour",
  "zar",
  "zar_per_kwh",
  "zar_per_mwh",
  "zar_per_kg"
] as const;

export type MeasurementUnit = (typeof MEASUREMENT_UNITS)[number];

export const MEMBERSHIP_ROLES = [
  "portfolio_admin",
  "plant_manager",
  "operator",
  "engineer",
  "analyst",
  "viewer",
  "developer",
  "super_admin"
] as const;

export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

export const ASSET_TYPES = [
  "grid_connection",
  "revenue_meter",
  "plant_power_controller",
  "inverter",
  "solar_array",
  "weather_station",
  "transformer",
  "feeder",
  "switchgear",
  "protection_relay",
  "bess",
  "battery_management_system",
  "battery_rack",
  "power_conversion_system",
  "electrolyser",
  "hydrogen_storage",
  "compressor",
  "flexible_load",
  "edge_gateway",
  "sensor",
  "virtual_asset"
] as const;

export type AssetType = (typeof ASSET_TYPES)[number];

export const NODE_HEALTH_STATES = [
  "online",
  "stale",
  "degraded",
  "offline",
  "maintenance",
  "disabled"
] as const;

export type NodeHealthState = (typeof NODE_HEALTH_STATES)[number];

/** Prefer kW for power and kWh for energy in storage/API unless explicitly MW/MWh. */
export const POWER_DISPLAY_UNIT: MeasurementUnit = "kW";
export const ENERGY_DISPLAY_UNIT: MeasurementUnit = "kWh";

export const DATA_SOURCE_LABELS: Record<DataSourceType, string> = {
  measured: "Measured",
  calculated: "Calculated",
  forecast: "Forecast",
  estimated: "Estimated",
  simulated: "Simulated",
  operator_entered: "Operator entered",
  imported: "Imported"
};

export const DATA_QUALITY_LABELS: Record<DataQuality, string> = {
  valid: "Valid",
  uncertain: "Uncertain",
  stale: "Stale",
  missing: "Missing",
  invalid: "Invalid",
  substituted: "Substituted",
  unverified: "Unverified"
};
