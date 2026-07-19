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
