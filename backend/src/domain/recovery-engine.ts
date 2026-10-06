/**
 * Pure Renewable Energy Recovery Engine.
 * No database, network, Express, or command-service dependencies.
 * Advisory-only: classifies loss, values impact, and ranks recovery options.
 */

export type RecoveryCause =
  | "none"
  | "grid_instruction"
  | "equipment_fault"
  | "export_limit"
  | "weather"
  | "performance_gap";

export type RecoverySample = {
  timestamp: string;
  expectedPowerKw: number;
  actualPowerKw: number;
  exportLimitKw?: number;
  irradianceWm2?: number;
  inverterAvailable?: boolean;
  gridInstructionActive?: boolean;
};

export type RecoveryAssumptions = {
  intervalMinutes: number;
  tariffZarPerKwh: number;
  gridEmissionFactorKgPerKwh: number;
  flexibleLoadCapacityKw: number;
  batteryUsableEnergyKwh: number;
  batteryRoundTripEfficiency: number;
  electrolyserCapacityKw: number;
  electrolyserEfficiencyKwhPerKg: number;
  hydrogenValueZarPerKg: number;
};

export type RecoveryOpportunity = {
  id: "flexible_load" | "battery" | "green_hydrogen";
  label: string;
  recoverableEnergyKwh: number;
  estimatedGrossValueZar: number;
  readiness: "demo_estimate";
  notes: string;
  ranking: number;
};

export type RecoveryAnalysis = {
  analysisMode: "advisory_only";
  dominantCause: RecoveryCause;
  causeLabel: string;
  confidence: number;
  expectedEnergyKwh: number;
  actualEnergyKwh: number;
  lostEnergyKwh: number;
  performanceRatioPercent: number;
  revenueAtRiskZar: number;
  carbonOpportunityKg: number;
  affectedIntervals: number;
  sampleCount: number;
  evidence: string[];
  recommendation: string;
  opportunities: RecoveryOpportunity[];
  assumptions: RecoveryAssumptions;
  disclaimer: string;
};

const CAUSE_LABELS: Record<RecoveryCause, string> = {
  none: "No material loss",
  grid_instruction: "Grid curtailment instruction",
  equipment_fault: "Equipment availability loss",
  export_limit: "Export limit constraint",
  weather: "Low irradiance / weather",
  performance_gap: "General performance gap"
};

export const defaultRecoveryAssumptions = (): RecoveryAssumptions => ({
  intervalMinutes: 10,
  tariffZarPerKwh: 2.25,
  gridEmissionFactorKgPerKwh: 0.928,
  flexibleLoadCapacityKw: 180,
  batteryUsableEnergyKwh: 300,
  batteryRoundTripEfficiency: 0.9,
  electrolyserCapacityKw: 120,
  electrolyserEfficiencyKwhPerKg: 52.5,
  hydrogenValueZarPerKg: 120
});

const round2 = (value: number): number => Math.round(value * 100) / 100;
const round4 = (value: number): number => Math.round(value * 10000) / 10000;

const assertFiniteNonNegative = (value: number, label: string): void => {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a finite number greater than or equal to zero.`);
  }
};

const mergeAssumptions = (overrides?: Partial<RecoveryAssumptions>): RecoveryAssumptions => {
  const base = defaultRecoveryAssumptions();
  const merged: RecoveryAssumptions = { ...base, ...(overrides ?? {}) };
  assertFiniteNonNegative(merged.intervalMinutes, "intervalMinutes");
  if (merged.intervalMinutes <= 0 || merged.intervalMinutes > 60) {
    throw new Error("intervalMinutes must be between 1 and 60.");
  }
  assertFiniteNonNegative(merged.tariffZarPerKwh, "tariffZarPerKwh");
  assertFiniteNonNegative(merged.gridEmissionFactorKgPerKwh, "gridEmissionFactorKgPerKwh");
  assertFiniteNonNegative(merged.flexibleLoadCapacityKw, "flexibleLoadCapacityKw");
  assertFiniteNonNegative(merged.batteryUsableEnergyKwh, "batteryUsableEnergyKwh");
  if (
    !Number.isFinite(merged.batteryRoundTripEfficiency) ||
    merged.batteryRoundTripEfficiency <= 0 ||
    merged.batteryRoundTripEfficiency > 1
  ) {
    throw new Error("batteryRoundTripEfficiency must be between 0 (exclusive) and 1.");
  }
  assertFiniteNonNegative(merged.electrolyserCapacityKw, "electrolyserCapacityKw");
  if (
    !Number.isFinite(merged.electrolyserEfficiencyKwhPerKg) ||
    merged.electrolyserEfficiencyKwhPerKg <= 0
  ) {
    throw new Error("electrolyserEfficiencyKwhPerKg must be a positive finite number.");
  }
  assertFiniteNonNegative(merged.hydrogenValueZarPerKg, "hydrogenValueZarPerKg");
  return merged;
};

type IntervalClassification = {
  cause: RecoveryCause;
  confidence: number;
  gapKw: number;
  material: boolean;
};

const classifyInterval = (sample: RecoverySample): IntervalClassification => {
  const gapKw = Math.max(0, sample.expectedPowerKw - sample.actualPowerKw);
  const materialThreshold = Math.max(10, sample.expectedPowerKw * 0.05);
  if (gapKw < materialThreshold) {
    return { cause: "none", confidence: 0.98, gapKw, material: false };
  }

  if (sample.gridInstructionActive === true) {
    return { cause: "grid_instruction", confidence: 0.97, gapKw, material: true };
  }

  if (sample.inverterAvailable === false) {
    return { cause: "equipment_fault", confidence: 0.95, gapKw, material: true };
  }

  if (
    typeof sample.exportLimitKw === "number" &&
    Number.isFinite(sample.exportLimitKw) &&
    sample.expectedPowerKw > sample.exportLimitKw
  ) {
    const limit = sample.exportLimitKw;
    const withinLimitBand = Math.abs(sample.actualPowerKw - limit) <= limit * 0.03;
    if (withinLimitBand) {
      return { cause: "export_limit", confidence: 0.92, gapKw, material: true };
    }
  }

  if (typeof sample.irradianceWm2 === "number" && sample.irradianceWm2 < 200) {
    return { cause: "weather", confidence: 0.78, gapKw, material: true };
  }

  return { cause: "performance_gap", confidence: 0.68, gapKw, material: true };
};

const buildEvidence = (
  dominantCause: RecoveryCause,
  classifications: IntervalClassification[],
  samples: RecoverySample[],
  assumptions: RecoveryAssumptions,
  lostEnergyKwh: number
): string[] => {
  const material = classifications.filter((row) => row.material);
  const evidence: string[] = [];

  if (dominantCause === "none") {
    evidence.push("No interval showed a material generation gap (below max(10 kW, 5% of expected)).");
    evidence.push("Classification confidence describes rule strength, not operational certainty.");
    return evidence;
  }

  evidence.push(
    `${material.length} of ${samples.length} intervals show a material gap (≥ max(10 kW, 5% of expected)).`
  );
  evidence.push(`Estimated lost energy over the window: ${round2(lostEnergyKwh)} kWh.`);

  if (dominantCause === "export_limit") {
    const limited = samples.filter(
      (sample, index) =>
        classifications[index]?.cause === "export_limit" &&
        typeof sample.exportLimitKw === "number"
    );
    const limit = limited[0]?.exportLimitKw;
    if (limit !== undefined) {
      evidence.push(
        `Expected output exceeded the ${limit} kW export limit while measured output stayed near the limit.`
      );
    }
  }

  if (dominantCause === "grid_instruction") {
    evidence.push("gridInstructionActive was set on the dominant constrained intervals.");
  }

  if (dominantCause === "equipment_fault") {
    evidence.push("inverterAvailable was false on the dominant constrained intervals.");
  }

  if (dominantCause === "weather") {
    evidence.push("Irradiance fell below 200 W/m² on the dominant constrained intervals.");
  }

  if (dominantCause === "performance_gap") {
    evidence.push("A material gap was present without a stronger export, grid, fault or weather signal.");
  }

  evidence.push(
    `Gross value uses tariff R${assumptions.tariffZarPerKwh.toFixed(2)}/kWh and excludes CAPEX, OPEX, degradation and site constraints.`
  );
  evidence.push("Classification confidence is a decision aid, not proof of root cause.");
  return evidence;
};

const buildRecommendation = (
  dominantCause: RecoveryCause,
  opportunities: RecoveryOpportunity[],
  lostEnergyKwh: number
): string => {
  if (dominantCause === "none") {
    return "No material recoverable loss was detected in this window. Continue monitoring; do not issue plant commands from this view.";
  }

  const top = opportunities[0];
  const causeText = CAUSE_LABELS[dominantCause].toLowerCase();
  if (!top) {
    return `Approximately ${round2(lostEnergyKwh)} kWh appears lost due to ${causeText}. Verify plant evidence before acting. This analysis is advisory only.`;
  }

  return (
    `Approximately ${round2(lostEnergyKwh)} kWh appears lost due to ${causeText}. ` +
    `The highest gross-value advisory option in this demonstration is ${top.label.toLowerCase()} ` +
    `(~${round2(top.recoverableEnergyKwh)} kWh / R${round2(top.estimatedGrossValueZar)}). ` +
    "An operator must verify telemetry and site constraints before any commercial decision. " +
    "GridFlex AI does not control plant equipment from this analysis."
  );
};

const rankOpportunities = (
  lostEnergyKwh: number,
  sampleCount: number,
  assumptions: RecoveryAssumptions
): RecoveryOpportunity[] => {
  const intervalHours = assumptions.intervalMinutes / 60;
  const eventDurationHours = sampleCount * intervalHours;

  const flexibleEnergy = Math.min(
    lostEnergyKwh,
    assumptions.flexibleLoadCapacityKw * eventDurationHours
  );
  const batteryEnergy =
    Math.min(lostEnergyKwh, assumptions.batteryUsableEnergyKwh) * assumptions.batteryRoundTripEfficiency;
  const hydrogenInput = Math.min(
    lostEnergyKwh,
    assumptions.electrolyserCapacityKw * eventDurationHours
  );
  const hydrogenKg = hydrogenInput / assumptions.electrolyserEfficiencyKwhPerKg;

  const options: RecoveryOpportunity[] = [
    {
      id: "flexible_load",
      label: "Flexible load",
      recoverableEnergyKwh: round2(flexibleEnergy),
      estimatedGrossValueZar: round2(flexibleEnergy * assumptions.tariffZarPerKwh),
      readiness: "demo_estimate",
      notes: "Assumes load can absorb surplus within configured capacity for the event duration.",
      ranking: 0
    },
    {
      id: "battery",
      label: "Battery storage",
      recoverableEnergyKwh: round2(batteryEnergy),
      estimatedGrossValueZar: round2(batteryEnergy * assumptions.tariffZarPerKwh),
      readiness: "demo_estimate",
      notes: "Applies round-trip efficiency to usable battery energy. Site SOC and cycling limits not modelled.",
      ranking: 0
    },
    {
      id: "green_hydrogen",
      label: "Green hydrogen",
      recoverableEnergyKwh: round2(hydrogenInput),
      estimatedGrossValueZar: round2(hydrogenKg * assumptions.hydrogenValueZarPerKg),
      readiness: "demo_estimate",
      notes: `Converts routed energy at ${assumptions.electrolyserEfficiencyKwhPerKg} kWh/kg. Water, storage and offtake costs excluded.`,
      ranking: 0
    }
  ];

  options.sort((a, b) => b.estimatedGrossValueZar - a.estimatedGrossValueZar);
  return options.map((option, index) => ({ ...option, ranking: index + 1 }));
};

export const analyseRecoveryOpportunity = (
  samples: RecoverySample[],
  overrides?: Partial<RecoveryAssumptions>
): RecoveryAnalysis => {
  if (!Array.isArray(samples) || samples.length === 0) {
    throw new Error("At least one recovery sample is required.");
  }
  if (samples.length > 288) {
    throw new Error("A maximum of 288 recovery samples is allowed.");
  }

  for (const [index, sample] of samples.entries()) {
    assertFiniteNonNegative(sample.expectedPowerKw, `samples[${index}].expectedPowerKw`);
    assertFiniteNonNegative(sample.actualPowerKw, `samples[${index}].actualPowerKw`);
    if (sample.exportLimitKw !== undefined) {
      assertFiniteNonNegative(sample.exportLimitKw, `samples[${index}].exportLimitKw`);
    }
    if (sample.irradianceWm2 !== undefined) {
      assertFiniteNonNegative(sample.irradianceWm2, `samples[${index}].irradianceWm2`);
    }
  }

  const assumptions = mergeAssumptions(overrides);
  const intervalHours = assumptions.intervalMinutes / 60;

  let expectedEnergyKwh = 0;
  let actualEnergyKwh = 0;
  let lostEnergyKwh = 0;
  const classifications = samples.map((sample) => {
    expectedEnergyKwh += sample.expectedPowerKw * intervalHours;
    actualEnergyKwh += sample.actualPowerKw * intervalHours;
    const classification = classifyInterval(sample);
    lostEnergyKwh += classification.gapKw * intervalHours;
    return classification;
  });

  const material = classifications.filter((row) => row.material);
  const causeCounts = new Map<RecoveryCause, { count: number; confidenceSum: number }>();
  for (const row of material) {
    const current = causeCounts.get(row.cause) ?? { count: 0, confidenceSum: 0 };
    current.count += 1;
    current.confidenceSum += row.confidence;
    causeCounts.set(row.cause, current);
  }

  let dominantCause: RecoveryCause = "none";
  let confidence = 0.98;
  if (material.length > 0) {
    let bestCount = -1;
    for (const [cause, stats] of causeCounts.entries()) {
      if (stats.count > bestCount) {
        bestCount = stats.count;
        dominantCause = cause;
        confidence = stats.confidenceSum / stats.count;
      }
    }
  }

  const opportunities = rankOpportunities(lostEnergyKwh, samples.length, assumptions);
  const evidence = buildEvidence(dominantCause, classifications, samples, assumptions, lostEnergyKwh);
  const recommendation = buildRecommendation(dominantCause, opportunities, lostEnergyKwh);
  const performanceRatioPercent =
    expectedEnergyKwh > 0 ? (actualEnergyKwh / expectedEnergyKwh) * 100 : 100;

  return {
    analysisMode: "advisory_only",
    dominantCause,
    causeLabel: CAUSE_LABELS[dominantCause],
    confidence: round4(confidence),
    expectedEnergyKwh: round2(expectedEnergyKwh),
    actualEnergyKwh: round2(actualEnergyKwh),
    lostEnergyKwh: round2(lostEnergyKwh),
    performanceRatioPercent: round2(performanceRatioPercent),
    revenueAtRiskZar: round2(lostEnergyKwh * assumptions.tariffZarPerKwh),
    carbonOpportunityKg: round2(lostEnergyKwh * assumptions.gridEmissionFactorKgPerKwh),
    affectedIntervals: material.length,
    sampleCount: samples.length,
    evidence,
    recommendation,
    opportunities,
    assumptions,
    disclaimer:
      "Advisory only. Gross-value estimates exclude site-specific capital and operating costs. Physical plant execution remains disabled."
  };
};
