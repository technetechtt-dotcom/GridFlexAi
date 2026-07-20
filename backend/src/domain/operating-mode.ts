/**
 * Display / API provenance contract for every numeric reading shown in the UI.
 * DB enums remain DataSourceType / DataQuality; map via toProvenance().
 */

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

export const GRIDFLEX_OPERATING_MODES = [
  "SIMULATION",
  "HIL",
  "PILOT_LIVE",
  "PRODUCTION_ADVISORY"
] as const;

export type GridFlexOperatingMode = (typeof GRIDFLEX_OPERATING_MODES)[number];

export const OPERATING_MODE_LABELS: Record<GridFlexOperatingMode, string> = {
  SIMULATION: "Simulation",
  HIL: "Hardware-in-the-loop",
  PILOT_LIVE: "Pilot live (measured advisory)",
  PRODUCTION_ADVISORY: "Production advisory (measured)"
};

/** Map DB DataSourceType onto the display TelemetryProvenance set. */
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
  if (sourceType === "calculated" || sourceType === "imported") {
    return "estimated";
  }
  return "estimated";
};

/** Map DB DataQuality onto display ProvenanceQuality. */
export const toProvenanceQuality = (quality: string): ProvenanceQuality => {
  if (quality === "valid") return "good";
  if (quality === "uncertain" || quality === "substituted" || quality === "unverified") return "uncertain";
  if (quality === "stale" || quality === "missing") return "stale";
  if (quality === "invalid") return "bad";
  return "uncertain";
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
