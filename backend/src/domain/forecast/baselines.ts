/**
 * Clear-sky / persistence forecast baselines.
 * Cloud-cover-derived irradiance must never be labelled as measured.
 */
export {
  clearSkyBaselineKw,
  persistenceBaselineKw,
  scoreForecast,
  meanAbsoluteError,
  rootMeanSquareError,
  meanAbsolutePercentageError,
  forecastBias,
  type ForecastPoint
} from "./scoring.js";

export type BaselineSourceLabel = "estimated" | "simulated" | "forecast";

/** Document that clear-sky outputs are estimated, never measured irradiance. */
export const CLEAR_SKY_SOURCE_TYPE: BaselineSourceLabel = "estimated";

/** Persistence baseline is calculated from prior measured power, not irradiance. */
export const PERSISTENCE_SOURCE_TYPE: BaselineSourceLabel = "estimated";
