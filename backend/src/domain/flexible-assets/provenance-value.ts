import type { DataQuality, DataSourceType } from "../provenance.js";

/**
 * Provenanced numeric/string value. Distinguishes configured, measured and
 * simulated inputs so advisory optimisation never pretends state is measured.
 */
export type ProvenancedValue<T> = {
  value: T;
  source: DataSourceType;
  quality: DataQuality;
  asOf?: string;
  note?: string;
};

export const provenanced = <T>(
  value: T,
  source: DataSourceType,
  quality: DataQuality = "valid",
  extras?: { asOf?: string; note?: string }
): ProvenancedValue<T> => {
  const result: ProvenancedValue<T> = { value, source, quality };
  if (extras?.asOf) result.asOf = extras.asOf;
  if (extras?.note) result.note = extras.note;
  return result;
};

export const isMeasured = (value: ProvenancedValue<unknown>): boolean =>
  value.source === "measured";

export const isSimulatedOrEstimated = (value: ProvenancedValue<unknown>): boolean =>
  value.source === "simulated" ||
  value.source === "estimated" ||
  value.source === "forecast";
