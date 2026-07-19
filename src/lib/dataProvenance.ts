import type { DataQuality, DataSourceType } from "./dataProvenanceTypes";
import { DATA_QUALITY_LABELS, DATA_SOURCE_LABELS } from "./dataProvenanceTypes";

export {
  DATA_SOURCE_TYPES,
  DATA_QUALITIES,
  MEASUREMENT_UNITS,
  DATA_SOURCE_LABELS,
  DATA_QUALITY_LABELS,
  type DataSourceType,
  type DataQuality,
  type MeasurementUnit
} from "./dataProvenanceTypes";

export function provenanceTooltip(sourceType: DataSourceType, quality?: DataQuality): string {
  const source = DATA_SOURCE_LABELS[sourceType];
  if (!quality) {
    return `${source} data. This value is not necessarily a direct plant measurement.`;
  }
  return `${source} data with ${DATA_QUALITY_LABELS[quality].toLowerCase()} quality.`;
}
