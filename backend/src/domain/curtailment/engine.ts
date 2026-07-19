export const CURTAILMENT_CAUSES = [
  "grid_instruction",
  "network_congestion",
  "export_limit",
  "ppc_limit",
  "negative_price",
  "economic_dispatch",
  "inverter_clipping",
  "inverter_derating",
  "equipment_fault",
  "maintenance",
  "weather",
  "unknown"
] as const;

export type CurtailmentCause = (typeof CURTAILMENT_CAUSES)[number];

export type AvailablePowerEvidence = {
  source:
    | "inverter_available_power"
    | "ppc_available_power"
    | "weather_performance_model"
    | "peer_inverter_comparison"
    | "historical_baseline";
  availablePowerKw: number;
  confidence: number;
  quality: "valid" | "uncertain" | "stale" | "invalid" | "unverified";
};

export type CurtailmentSample = {
  timestamp: string;
  actualPowerKw: number;
  availableCandidates: AvailablePowerEvidence[];
  exportLimitKw?: number;
  ppcSetpointKw?: number;
  inverterFault?: boolean;
  inverterUnavailable?: boolean;
  clippingKw?: number;
  deratingKw?: number;
  gridInstruction?: boolean;
  networkCongestion?: boolean;
  negativePrice?: boolean;
  economicDispatch?: boolean;
  maintenance?: boolean;
};

export type CurtailmentDetectionConfig = {
  minimumCurtailedPowerKw: number;
  persistenceSamples: number;
  mergeGapMs: number;
  calculationVersion: string;
};

export const DEFAULT_CURTAILMENT_CONFIG: CurtailmentDetectionConfig = {
  minimumCurtailedPowerKw: 50,
  persistenceSamples: 3,
  mergeGapMs: 5 * 60 * 1000,
  calculationVersion: "curtailment-v1"
};

const EVIDENCE_RANK: AvailablePowerEvidence["source"][] = [
  "inverter_available_power",
  "ppc_available_power",
  "weather_performance_model",
  "peer_inverter_comparison",
  "historical_baseline"
];

export const selectAvailablePower = (
  candidates: AvailablePowerEvidence[]
): AvailablePowerEvidence | null => {
  const usable = candidates.filter(
    (candidate) =>
      Number.isFinite(candidate.availablePowerKw) &&
      candidate.availablePowerKw >= 0 &&
      candidate.quality !== "invalid"
  );
  if (usable.length === 0) return null;

  usable.sort((left, right) => {
    const rankDelta =
      EVIDENCE_RANK.indexOf(left.source) - EVIDENCE_RANK.indexOf(right.source);
    if (rankDelta !== 0) return rankDelta;
    return right.confidence - left.confidence;
  });
  return usable[0] ?? null;
};

export const classifyCurtailmentCause = (
  sample: CurtailmentSample,
  available: AvailablePowerEvidence
): { cause: CurtailmentCause; causeConfidence: number; recoverable: boolean } => {
  // Equipment faults are never recoverable grid curtailment.
  if (sample.inverterFault || sample.inverterUnavailable) {
    return { cause: "equipment_fault", causeConfidence: 0.95, recoverable: false };
  }
  if (sample.maintenance) {
    return { cause: "maintenance", causeConfidence: 0.9, recoverable: false };
  }
  if ((sample.clippingKw ?? 0) > 0 && (sample.clippingKw ?? 0) >= available.availablePowerKw - sample.actualPowerKw - 1) {
    return { cause: "inverter_clipping", causeConfidence: 0.85, recoverable: false };
  }
  if ((sample.deratingKw ?? 0) > 0) {
    return { cause: "inverter_derating", causeConfidence: 0.8, recoverable: false };
  }
  if (sample.gridInstruction) {
    return { cause: "grid_instruction", causeConfidence: 0.92, recoverable: true };
  }
  if (sample.networkCongestion) {
    return { cause: "network_congestion", causeConfidence: 0.88, recoverable: true };
  }
  if (sample.negativePrice) {
    return { cause: "negative_price", causeConfidence: 0.85, recoverable: true };
  }
  if (sample.economicDispatch) {
    return { cause: "economic_dispatch", causeConfidence: 0.82, recoverable: true };
  }
  if (typeof sample.exportLimitKw === "number" && sample.actualPowerKw >= sample.exportLimitKw - 1) {
    return { cause: "export_limit", causeConfidence: 0.9, recoverable: true };
  }
  if (typeof sample.ppcSetpointKw === "number" && sample.actualPowerKw >= sample.ppcSetpointKw - 1) {
    return { cause: "ppc_limit", causeConfidence: 0.88, recoverable: true };
  }
  if (available.source === "weather_performance_model" && available.quality !== "valid") {
    return { cause: "weather", causeConfidence: Math.min(0.7, available.confidence), recoverable: false };
  }
  return { cause: "unknown", causeConfidence: Math.min(0.55, available.confidence), recoverable: true };
};

export const calculateCurtailedPowerKw = (availablePowerKw: number, actualPowerKw: number): number =>
  Math.max(0, availablePowerKw - actualPowerKw);

/** Trapezoidal integration of power (kW) over time → energy (kWh). */
export const integrateEnergyKwh = (
  points: Array<{ timestampMs: number; powerKw: number }>
): number => {
  if (points.length < 2) return 0;
  const ordered = [...points].sort((a, b) => a.timestampMs - b.timestampMs);
  let energyKwh = 0;
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1]!;
    const current = ordered[index]!;
    const hours = (current.timestampMs - previous.timestampMs) / 3_600_000;
    if (hours <= 0) continue;
    energyKwh += ((previous.powerKw + current.powerKw) / 2) * hours;
  }
  return energyKwh;
};

export type DetectedCurtailmentInterval = {
  startTime: string;
  endTime: string;
  cause: CurtailmentCause;
  causeConfidence: number;
  availablePowerKw: number;
  actualPowerKw: number;
  curtailedPowerKw: number;
  estimatedLostEnergyKwh: number;
  recoverableEnergyKwh: number;
  exportLimitKw: number | null;
  ppcSetpointKw: number | null;
  evidence: AvailablePowerEvidence[];
  calculationVersion: string;
};

export const detectCurtailmentEvents = (
  samples: CurtailmentSample[],
  config: CurtailmentDetectionConfig = DEFAULT_CURTAILMENT_CONFIG
): DetectedCurtailmentInterval[] => {
  const ordered = [...samples].sort(
    (left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp)
  );

  type Active = {
    startTime: string;
    endTime: string;
    cause: CurtailmentCause;
    causeConfidence: number;
    recoverable: boolean;
    points: Array<{ timestampMs: number; powerKw: number; availableKw: number; actualKw: number }>;
    evidence: AvailablePowerEvidence[];
    exportLimitKw: number | null;
    ppcSetpointKw: number | null;
  };

  const open: Active[] = [];
  let pending: Active | null = null;
  let streak = 0;

  for (const sample of ordered) {
    if (sample.inverterUnavailable) {
      if (pending && pending.points.length >= config.persistenceSamples) {
        open.push(pending);
      }
      streak = 0;
      pending = null;
      continue;
    }

    const available = selectAvailablePower(sample.availableCandidates);
    if (!available) {
      if (pending && pending.points.length >= config.persistenceSamples) {
        open.push(pending);
      }
      streak = 0;
      pending = null;
      continue;
    }

    let availablePowerKw = available.availablePowerKw;
    if (sample.clippingKw) availablePowerKw = Math.max(sample.actualPowerKw, availablePowerKw - sample.clippingKw);
    if (sample.deratingKw) availablePowerKw = Math.max(sample.actualPowerKw, availablePowerKw - sample.deratingKw);

    const curtailedPowerKw = calculateCurtailedPowerKw(availablePowerKw, sample.actualPowerKw);
    const classification = classifyCurtailmentCause(sample, available);
    const timestampMs = Date.parse(sample.timestamp);

    if (curtailedPowerKw < config.minimumCurtailedPowerKw) {
      if (pending && pending.points.length >= config.persistenceSamples) {
        open.push(pending);
      }
      streak = 0;
      pending = null;
      continue;
    }

    streak += 1;
    const point = {
      timestampMs,
      powerKw: curtailedPowerKw,
      availableKw: availablePowerKw,
      actualKw: sample.actualPowerKw
    };

    if (!pending) {
      pending = {
        startTime: sample.timestamp,
        endTime: sample.timestamp,
        cause: classification.cause,
        causeConfidence: classification.causeConfidence,
        recoverable: classification.recoverable,
        points: [point],
        evidence: [available],
        exportLimitKw: sample.exportLimitKw ?? null,
        ppcSetpointKw: sample.ppcSetpointKw ?? null
      };
    } else {
      pending.endTime = sample.timestamp;
      pending.points.push(point);
      pending.evidence.push(available);
      pending.causeConfidence = Math.min(pending.causeConfidence, classification.causeConfidence);
      if (classification.cause !== "unknown") {
        pending.cause = classification.cause;
        pending.recoverable = classification.recoverable;
      }
    }
  }

  if (pending && pending.points.length >= config.persistenceSamples) {
    open.push(pending);
  }

  // Merge adjacent intervals of the same recoverable/non-fault cause.
  const merged: Active[] = [];
  for (const interval of open) {
    const previous = merged[merged.length - 1];
    if (
      previous &&
      previous.cause === interval.cause &&
      Date.parse(interval.startTime) - Date.parse(previous.endTime) <= config.mergeGapMs
    ) {
      previous.endTime = interval.endTime;
      previous.points.push(...interval.points);
      previous.evidence.push(...interval.evidence);
      previous.causeConfidence = Math.min(previous.causeConfidence, interval.causeConfidence);
      continue;
    }
    merged.push(interval);
  }

  return merged.map((interval) => {
    const estimatedLostEnergyKwh = integrateEnergyKwh(interval.points);
    const avgAvailable =
      interval.points.reduce((sum, point) => sum + point.availableKw, 0) / interval.points.length;
    const avgActual =
      interval.points.reduce((sum, point) => sum + point.actualKw, 0) / interval.points.length;
    const avgCurtailed =
      interval.points.reduce((sum, point) => sum + point.powerKw, 0) / interval.points.length;
    return {
      startTime: interval.startTime,
      endTime: interval.endTime,
      cause: interval.cause,
      causeConfidence: interval.causeConfidence,
      availablePowerKw: Number(avgAvailable.toFixed(3)),
      actualPowerKw: Number(avgActual.toFixed(3)),
      curtailedPowerKw: Number(avgCurtailed.toFixed(3)),
      estimatedLostEnergyKwh: Number(estimatedLostEnergyKwh.toFixed(3)),
      recoverableEnergyKwh: interval.recoverable
        ? Number(estimatedLostEnergyKwh.toFixed(3))
        : 0,
      exportLimitKw: interval.exportLimitKw,
      ppcSetpointKw: interval.ppcSetpointKw,
      evidence: interval.evidence,
      calculationVersion: config.calculationVersion
    };
  });
};
