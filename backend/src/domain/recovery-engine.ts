/**
 * Pure Renewable Energy Recovery Engine.
 * No database, network, Express, or command-service dependencies.
 * Advisory-only: classifies loss, values impact, and ranks recovery options.
 */

export const RECOVERY_ALGORITHM_VERSION = "recovery-engine@1.1.0";

export type RecoveryCause =
  | "none"
  | "grid_instruction"
  | "equipment_fault"
  | "export_limit"
  | "weather"
  | "performance_gap";

export type RecoveryDataEnvironment = "live" | "simulation" | "hil" | "synthetic_demo";

export type RecoverySample = {
  timestamp: string;
  expectedPowerKw: number;
  actualPowerKw: number;
  exportLimitKw?: number;
  irradianceWm2?: number;
  inverterAvailable?: boolean;
  gridInstructionActive?: boolean;
  /** Optional measurement provenance for persistence / audit. */
  expectedSourceType?: "forecast" | "estimated" | "simulated" | "operator_entered";
  actualSourceType?: "measured" | "calculated" | "simulated" | "operator_entered" | "imported";
  quality?: "valid" | "uncertain" | "stale" | "invalid" | "unverified";
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
  readiness: "demo_estimate" | "site_estimate";
  notes: string;
  ranking: number;
};

export type RecoveryIntervalResult = {
  timestamp: string;
  expectedPowerKw: number;
  actualPowerKw: number;
  gapKw: number;
  lostEnergyKwh: number;
  material: boolean;
  materialThresholdKw: number;
  cause: RecoveryCause;
  causeLabel: string;
  confidence: number;
  exportLimitKw?: number;
  irradianceWm2?: number;
  opportunities: Array<{
    id: RecoveryOpportunity["id"];
    recoverableEnergyKwh: number;
    estimatedGrossValueZar: number;
  }>;
};

export type RecoveryProvenance = {
  algorithmVersion: string;
  dataEnvironment: RecoveryDataEnvironment;
  sampleCount: number;
  expectedSourceSummary: string;
  actualSourceSummary: string;
  qualitySummary: string;
  syntheticDemo: boolean;
};

export type AnnualFinancialModel = {
  assumedEventDaysPerYear: number;
  annualLostEnergyKwh: number;
  annualRevenueAtRiskZar: number;
  annualCarbonOpportunityKg: number;
  topOptionAnnualGrossValueZar: number;
  estimatedCapexZar: number;
  simplePaybackYears: number | null;
  notes: string;
};

export type RecoveryAnalysis = {
  analysisMode: "advisory_only";
  algorithmVersion: string;
  dominantCause: RecoveryCause;
  causeLabel: string;
  confidence: number;
  expectedEnergyKwh: number;
  actualEnergyKwh: number;
  /** Material-loss energy only (non-material gaps excluded). */
  lostEnergyKwh: number;
  /** Gross positive gap energy including non-material intervals (diagnostic). */
  grossGapEnergyKwh: number;
  performanceRatioPercent: number;
  revenueAtRiskZar: number;
  carbonOpportunityKg: number;
  affectedIntervals: number;
  /** Duration of material-loss intervals only. */
  affectedDurationHours: number;
  sampleCount: number;
  windowDurationHours: number;
  intervals: RecoveryIntervalResult[];
  evidence: string[];
  recommendation: string;
  opportunities: RecoveryOpportunity[];
  annualFinancialModel: AnnualFinancialModel;
  provenance: RecoveryProvenance;
  assumptions: RecoveryAssumptions;
  disclaimer: string;
};

export type AnalyseRecoveryOptions = {
  assumptions?: Partial<RecoveryAssumptions>;
  dataEnvironment?: RecoveryDataEnvironment;
  annualEventDays?: number;
  estimatedCapexZar?: number;
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
  materialThresholdKw: number;
};

const classifyInterval = (sample: RecoverySample): IntervalClassification => {
  const gapKw = Math.max(0, sample.expectedPowerKw - sample.actualPowerKw);
  const materialThresholdKw = Math.max(10, sample.expectedPowerKw * 0.05);
  if (gapKw < materialThresholdKw) {
    return { cause: "none", confidence: 0.98, gapKw, material: false, materialThresholdKw };
  }

  if (sample.gridInstructionActive === true) {
    return { cause: "grid_instruction", confidence: 0.97, gapKw, material: true, materialThresholdKw };
  }

  if (sample.inverterAvailable === false) {
    return { cause: "equipment_fault", confidence: 0.95, gapKw, material: true, materialThresholdKw };
  }

  if (
    typeof sample.exportLimitKw === "number" &&
    Number.isFinite(sample.exportLimitKw) &&
    sample.expectedPowerKw > sample.exportLimitKw
  ) {
    const limit = sample.exportLimitKw;
    const withinLimitBand = Math.abs(sample.actualPowerKw - limit) <= limit * 0.03;
    if (withinLimitBand) {
      return { cause: "export_limit", confidence: 0.92, gapKw, material: true, materialThresholdKw };
    }
  }

  if (typeof sample.irradianceWm2 === "number" && sample.irradianceWm2 < 200) {
    return { cause: "weather", confidence: 0.78, gapKw, material: true, materialThresholdKw };
  }

  return { cause: "performance_gap", confidence: 0.68, gapKw, material: true, materialThresholdKw };
};

const intervalOpportunitySlice = (
  lostEnergyKwh: number,
  intervalHours: number,
  assumptions: RecoveryAssumptions
): RecoveryIntervalResult["opportunities"] => {
  if (lostEnergyKwh <= 0) {
    return [
      { id: "flexible_load", recoverableEnergyKwh: 0, estimatedGrossValueZar: 0 },
      { id: "battery", recoverableEnergyKwh: 0, estimatedGrossValueZar: 0 },
      { id: "green_hydrogen", recoverableEnergyKwh: 0, estimatedGrossValueZar: 0 }
    ];
  }

  const flexible = Math.min(lostEnergyKwh, assumptions.flexibleLoadCapacityKw * intervalHours);
  const battery =
    Math.min(lostEnergyKwh, assumptions.batteryUsableEnergyKwh) * assumptions.batteryRoundTripEfficiency;
  const hydrogenInput = Math.min(lostEnergyKwh, assumptions.electrolyserCapacityKw * intervalHours);
  const hydrogenKg = hydrogenInput / assumptions.electrolyserEfficiencyKwhPerKg;

  return [
    {
      id: "flexible_load",
      recoverableEnergyKwh: round2(flexible),
      estimatedGrossValueZar: round2(flexible * assumptions.tariffZarPerKwh)
    },
    {
      id: "battery",
      recoverableEnergyKwh: round2(battery),
      estimatedGrossValueZar: round2(battery * assumptions.tariffZarPerKwh)
    },
    {
      id: "green_hydrogen",
      recoverableEnergyKwh: round2(hydrogenInput),
      estimatedGrossValueZar: round2(hydrogenKg * assumptions.hydrogenValueZarPerKg)
    }
  ];
};

const buildEvidence = (
  dominantCause: RecoveryCause,
  classifications: IntervalClassification[],
  samples: RecoverySample[],
  assumptions: RecoveryAssumptions,
  lostEnergyKwh: number,
  affectedDurationHours: number
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
  evidence.push(
    `Material-loss duration is ${round2(affectedDurationHours)} h; estimated lost energy is ${round2(lostEnergyKwh)} kWh.`
  );

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
  evidence.push(`Algorithm ${RECOVERY_ALGORITHM_VERSION}. Confidence is a decision aid, not proof of root cause.`);
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
    `The highest gross-value advisory option in this window is ${top.label.toLowerCase()} ` +
    `(~${round2(top.recoverableEnergyKwh)} kWh / R${round2(top.estimatedGrossValueZar)}). ` +
    "An operator must verify telemetry and site constraints before any commercial decision. " +
    "GridFlex AI does not control plant equipment from this analysis."
  );
};

const rankOpportunities = (
  lostEnergyKwh: number,
  affectedDurationHours: number,
  assumptions: RecoveryAssumptions,
  readiness: RecoveryOpportunity["readiness"]
): RecoveryOpportunity[] => {
  const flexibleEnergy = Math.min(
    lostEnergyKwh,
    assumptions.flexibleLoadCapacityKw * affectedDurationHours
  );
  const batteryEnergy =
    Math.min(lostEnergyKwh, assumptions.batteryUsableEnergyKwh) * assumptions.batteryRoundTripEfficiency;
  const hydrogenInput = Math.min(
    lostEnergyKwh,
    assumptions.electrolyserCapacityKw * affectedDurationHours
  );
  const hydrogenKg = hydrogenInput / assumptions.electrolyserEfficiencyKwhPerKg;

  const options: RecoveryOpportunity[] = [
    {
      id: "flexible_load",
      label: "Flexible load",
      recoverableEnergyKwh: round2(flexibleEnergy),
      estimatedGrossValueZar: round2(flexibleEnergy * assumptions.tariffZarPerKwh),
      readiness,
      notes: "Capacity applied over material-loss duration only, not the full analysis window.",
      ranking: 0
    },
    {
      id: "battery",
      label: "Battery storage",
      recoverableEnergyKwh: round2(batteryEnergy),
      estimatedGrossValueZar: round2(batteryEnergy * assumptions.tariffZarPerKwh),
      readiness,
      notes: "Applies round-trip efficiency to usable battery energy. Site SOC and cycling limits not modelled.",
      ranking: 0
    },
    {
      id: "green_hydrogen",
      label: "Green hydrogen",
      recoverableEnergyKwh: round2(hydrogenInput),
      estimatedGrossValueZar: round2(hydrogenKg * assumptions.hydrogenValueZarPerKg),
      readiness,
      notes: `Converts routed energy at ${assumptions.electrolyserEfficiencyKwhPerKg} kWh/kg over material-loss duration. Water, storage and offtake costs excluded.`,
      ranking: 0
    }
  ];

  options.sort((a, b) => b.estimatedGrossValueZar - a.estimatedGrossValueZar);
  return options.map((option, index) => ({ ...option, ranking: index + 1 }));
};

const summarise = (values: Array<string | undefined>, fallback: string): string => {
  const present = values.filter((value): value is string => Boolean(value));
  if (present.length === 0) return fallback;
  const counts = new Map<string, number>();
  for (const value of present) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => `${key}:${count}`)
    .join(", ");
};

const buildAnnualModel = (
  analysis: Pick<
    RecoveryAnalysis,
    "lostEnergyKwh" | "revenueAtRiskZar" | "carbonOpportunityKg" | "opportunities"
  >,
  options: { annualEventDays: number; estimatedCapexZar: number }
): AnnualFinancialModel => {
  const scale = options.annualEventDays;
  const top = analysis.opportunities[0]?.estimatedGrossValueZar ?? 0;
  const annualTop = top * scale;
  const payback =
    options.estimatedCapexZar > 0 && annualTop > 0
      ? round2(options.estimatedCapexZar / annualTop)
      : null;

  return {
    assumedEventDaysPerYear: scale,
    annualLostEnergyKwh: round2(analysis.lostEnergyKwh * scale),
    annualRevenueAtRiskZar: round2(analysis.revenueAtRiskZar * scale),
    annualCarbonOpportunityKg: round2(analysis.carbonOpportunityKg * scale),
    topOptionAnnualGrossValueZar: round2(annualTop),
    estimatedCapexZar: round2(options.estimatedCapexZar),
    simplePaybackYears: payback,
    notes:
      "Linear scale of this window across assumed event-days. Not a site investment case; CAPEX is an operator assumption."
  };
};

export const analyseRecoveryOpportunity = (
  samples: RecoverySample[],
  overridesOrOptions?: Partial<RecoveryAssumptions> | AnalyseRecoveryOptions
): RecoveryAnalysis => {
  let options: AnalyseRecoveryOptions = {};
  if (
    overridesOrOptions &&
    ("assumptions" in overridesOrOptions ||
      "dataEnvironment" in overridesOrOptions ||
      "annualEventDays" in overridesOrOptions ||
      "estimatedCapexZar" in overridesOrOptions)
  ) {
    options = overridesOrOptions as AnalyseRecoveryOptions;
  } else if (overridesOrOptions) {
    options = { assumptions: overridesOrOptions as Partial<RecoveryAssumptions> };
  }

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

  const assumptions = mergeAssumptions(options.assumptions);
  const intervalHours = assumptions.intervalMinutes / 60;
  const dataEnvironment = options.dataEnvironment ?? "synthetic_demo";
  const readiness: RecoveryOpportunity["readiness"] =
    dataEnvironment === "synthetic_demo" ? "demo_estimate" : "site_estimate";

  let expectedEnergyKwh = 0;
  let actualEnergyKwh = 0;
  let grossGapEnergyKwh = 0;
  let lostEnergyKwh = 0;
  const classifications: IntervalClassification[] = [];
  const intervals: RecoveryIntervalResult[] = [];

  for (const sample of samples) {
    expectedEnergyKwh += sample.expectedPowerKw * intervalHours;
    actualEnergyKwh += sample.actualPowerKw * intervalHours;
    const classification = classifyInterval(sample);
    classifications.push(classification);
    const intervalLost = classification.gapKw * intervalHours;
    grossGapEnergyKwh += intervalLost;
    const materialLost = classification.material ? intervalLost : 0;
    lostEnergyKwh += materialLost;

    intervals.push({
      timestamp: sample.timestamp,
      expectedPowerKw: sample.expectedPowerKw,
      actualPowerKw: sample.actualPowerKw,
      gapKw: round2(classification.gapKw),
      lostEnergyKwh: round2(materialLost),
      material: classification.material,
      materialThresholdKw: round2(classification.materialThresholdKw),
      cause: classification.cause,
      causeLabel: CAUSE_LABELS[classification.cause],
      confidence: round4(classification.confidence),
      ...(sample.exportLimitKw !== undefined ? { exportLimitKw: sample.exportLimitKw } : {}),
      ...(sample.irradianceWm2 !== undefined ? { irradianceWm2: sample.irradianceWm2 } : {}),
      opportunities: intervalOpportunitySlice(materialLost, intervalHours, assumptions)
    });
  }

  const material = classifications.filter((row) => row.material);
  const affectedDurationHours = material.length * intervalHours;
  const windowDurationHours = samples.length * intervalHours;

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

  const opportunities = rankOpportunities(
    lostEnergyKwh,
    affectedDurationHours,
    assumptions,
    readiness
  );
  const evidence = buildEvidence(
    dominantCause,
    classifications,
    samples,
    assumptions,
    lostEnergyKwh,
    affectedDurationHours
  );
  const recommendation = buildRecommendation(dominantCause, opportunities, lostEnergyKwh);
  const performanceRatioPercent =
    expectedEnergyKwh > 0 ? (actualEnergyKwh / expectedEnergyKwh) * 100 : 100;

  const analysisCore = {
    lostEnergyKwh: round2(lostEnergyKwh),
    revenueAtRiskZar: round2(lostEnergyKwh * assumptions.tariffZarPerKwh),
    carbonOpportunityKg: round2(lostEnergyKwh * assumptions.gridEmissionFactorKgPerKwh),
    opportunities
  };

  const annualFinancialModel = buildAnnualModel(analysisCore, {
    annualEventDays: options.annualEventDays ?? 120,
    estimatedCapexZar: options.estimatedCapexZar ?? 2_500_000
  });

  return {
    analysisMode: "advisory_only",
    algorithmVersion: RECOVERY_ALGORITHM_VERSION,
    dominantCause,
    causeLabel: CAUSE_LABELS[dominantCause],
    confidence: round4(confidence),
    expectedEnergyKwh: round2(expectedEnergyKwh),
    actualEnergyKwh: round2(actualEnergyKwh),
    lostEnergyKwh: analysisCore.lostEnergyKwh,
    grossGapEnergyKwh: round2(grossGapEnergyKwh),
    performanceRatioPercent: round2(performanceRatioPercent),
    revenueAtRiskZar: analysisCore.revenueAtRiskZar,
    carbonOpportunityKg: analysisCore.carbonOpportunityKg,
    affectedIntervals: material.length,
    affectedDurationHours: round2(affectedDurationHours),
    sampleCount: samples.length,
    windowDurationHours: round2(windowDurationHours),
    intervals,
    evidence,
    recommendation,
    opportunities,
    annualFinancialModel,
    provenance: {
      algorithmVersion: RECOVERY_ALGORITHM_VERSION,
      dataEnvironment,
      sampleCount: samples.length,
      expectedSourceSummary: summarise(
        samples.map((sample) => sample.expectedSourceType),
        dataEnvironment === "synthetic_demo" ? "simulated:demo" : "unspecified"
      ),
      actualSourceSummary: summarise(
        samples.map((sample) => sample.actualSourceType),
        dataEnvironment === "synthetic_demo" ? "simulated:demo" : "unspecified"
      ),
      qualitySummary: summarise(
        samples.map((sample) => sample.quality),
        dataEnvironment === "synthetic_demo" ? "synthetic" : "unspecified"
      ),
      syntheticDemo: dataEnvironment === "synthetic_demo"
    },
    assumptions,
    disclaimer:
      "Advisory only. Gross-value estimates exclude site-specific capital and operating costs. Physical plant execution remains disabled."
  };
};
