export type ForecastPoint = {
  timestamp: string;
  actualKw: number;
  forecastKw: number;
};

export const meanAbsoluteError = (points: ForecastPoint[]): number => {
  if (points.length === 0) return 0;
  const total = points.reduce((sum, point) => sum + Math.abs(point.forecastKw - point.actualKw), 0);
  return total / points.length;
};

export const rootMeanSquareError = (points: ForecastPoint[]): number => {
  if (points.length === 0) return 0;
  const total = points.reduce((sum, point) => {
    const error = point.forecastKw - point.actualKw;
    return sum + error * error;
  }, 0);
  return Math.sqrt(total / points.length);
};

export const meanAbsolutePercentageError = (points: ForecastPoint[]): number | null => {
  const usable = points.filter((point) => Math.abs(point.actualKw) > 1e-6);
  if (usable.length === 0) return null;
  const total = usable.reduce(
    (sum, point) => sum + Math.abs((point.forecastKw - point.actualKw) / point.actualKw),
    0
  );
  return (total / usable.length) * 100;
};

export const forecastBias = (points: ForecastPoint[]): number => {
  if (points.length === 0) return 0;
  const total = points.reduce((sum, point) => sum + (point.forecastKw - point.actualKw), 0);
  return total / points.length;
};

export const scoreForecast = (points: ForecastPoint[]) => ({
  maeKw: Number(meanAbsoluteError(points).toFixed(4)),
  rmseKw: Number(rootMeanSquareError(points).toFixed(4)),
  mapePercent: (() => {
    const mape = meanAbsolutePercentageError(points);
    return mape === null ? null : Number(mape.toFixed(4));
  })(),
  biasKw: Number(forecastBias(points).toFixed(4)),
  samples: points.length
});

/** Persistence baseline: next interval equals last measured power. */
export const persistenceBaselineKw = (historyKw: number[]): number[] => {
  if (historyKw.length === 0) return [];
  return historyKw.map((_, index) => (index === 0 ? historyKw[0]! : historyKw[index - 1]!));
};

/**
 * Clear-sky irradiance model is intentionally a stub: without site tilt/azimuth and
 * astronomical geometry this must be labelled estimated/simulated, never measured.
 */
export const clearSkyBaselineKw = (capacityAcKw: number, clearSkyFraction: number[]): number[] =>
  clearSkyFraction.map((fraction) => capacityAcKw * Math.max(0, Math.min(1, fraction)));
