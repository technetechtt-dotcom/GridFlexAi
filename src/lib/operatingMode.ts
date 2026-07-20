export const TELEMETRY_PROVENANCE_TYPES = [
  "measured",
  "simulated",
  "estimated",
  "forecast",
  "operator_entered"
] as const;

export type TelemetryProvenance = (typeof TELEMETRY_PROVENANCE_TYPES)[number];

export const PROVENANCE_QUALITIES = ["good", "uncertain", "bad", "stale"] as const;
export type ProvenanceQuality = (typeof PROVENANCE_QUALITIES)[number];

export type Provenance = {
  sourceType: TelemetryProvenance;
  sourceId: string;
  quality: ProvenanceQuality;
  measuredAt: string;
  receivedAt: string;
  unit: string;
  calibrationVersion?: string;
};

export type GridFlexOperatingMode =
  | "SIMULATION"
  | "HIL"
  | "PILOT_LIVE"
  | "PRODUCTION_ADVISORY";

export type OperatingModeResponse = {
  mode: GridFlexOperatingMode;
  label: string;
  defaultTelemetryEnvironment: "live" | "simulation" | "hil" | "all";
  liveNamespace: string;
  simulationNamespace: string;
  liveTelemetryPath: string;
  simulationTelemetryPath: string;
  simulationRunId: string | null;
  bannerTone: "blue" | "amber" | "green" | "red";
};

export const OPERATING_MODE_LABELS: Record<GridFlexOperatingMode, string> = {
  SIMULATION: "Simulation",
  HIL: "Hardware-in-the-loop",
  PILOT_LIVE: "Pilot live (measured advisory)",
  PRODUCTION_ADVISORY: "Production advisory (measured)"
};

export const toProvenanceQuality = (quality: string): ProvenanceQuality => {
  if (quality === "valid" || quality === "good") return "good";
  if (quality === "uncertain" || quality === "substituted" || quality === "unverified") return "uncertain";
  if (quality === "stale" || quality === "missing") return "stale";
  if (quality === "invalid" || quality === "bad") return "bad";
  return "uncertain";
};

export const toTelemetryProvenance = (sourceType: string): TelemetryProvenance => {
  if (
    sourceType === "measured" ||
    sourceType === "simulated" ||
    sourceType === "estimated" ||
    sourceType === "forecast" ||
    sourceType === "operator_entered"
  ) {
    return sourceType;
  }
  return "estimated";
};

export const buildProvenance = (input: {
  sourceType: string;
  sourceId: string;
  quality: string;
  measuredAt: Date | string;
  receivedAt: Date | string;
  unit: string;
  calibrationVersion?: string | null;
}): Provenance => {
  const provenance: Provenance = {
    sourceType: toTelemetryProvenance(input.sourceType),
    sourceId: input.sourceId,
    quality: toProvenanceQuality(input.quality),
    measuredAt: typeof input.measuredAt === "string" ? input.measuredAt : input.measuredAt.toISOString(),
    receivedAt: typeof input.receivedAt === "string" ? input.receivedAt : input.receivedAt.toISOString(),
    unit: input.unit
  };
  if (input.calibrationVersion) {
    provenance.calibrationVersion = input.calibrationVersion;
  }
  return provenance;
};
