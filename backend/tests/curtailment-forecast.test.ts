import {
  calculateCurtailedPowerKw,
  classifyCurtailmentCause,
  detectCurtailmentEvents,
  integrateEnergyKwh,
  selectAvailablePower,
  type CurtailmentSample
} from "../src/domain/curtailment/engine.js";
import {
  CLEAR_SKY_SOURCE_TYPE,
  clearSkyBaselineKw,
  persistenceBaselineKw
} from "../src/domain/forecast/baselines.js";
import { scoreForecast } from "../src/domain/forecast/scoring.js";

const available = (
  availablePowerKw: number,
  source: CurtailmentSample["availableCandidates"][number]["source"] = "inverter_available_power"
): CurtailmentSample["availableCandidates"] => [
  {
    source,
    availablePowerKw,
    confidence: 0.9,
    quality: "valid"
  }
];

const persistentExportLimitSamples = (overrides: Partial<CurtailmentSample> = {}): CurtailmentSample[] =>
  [0, 5, 10].map((minute) => ({
    timestamp: `2026-07-19T12:${String(minute).padStart(2, "0")}:00.000Z`,
    actualPowerKw: 400,
    exportLimitKw: 400,
    availableCandidates: available(1000),
    ...overrides
  }));

describe("curtailment engine", () => {
  it("computes curtailed power as max(0, available - actual)", () => {
    expect(calculateCurtailedPowerKw(1000, 700)).toBe(300);
    expect(calculateCurtailedPowerKw(500, 700)).toBe(0);
  });

  it("ranks inverter available-power evidence first", () => {
    const selected = selectAvailablePower([
      {
        source: "historical_baseline",
        availablePowerKw: 900,
        confidence: 0.99,
        quality: "valid"
      },
      {
        source: "inverter_available_power",
        availablePowerKw: 800,
        confidence: 0.7,
        quality: "valid"
      }
    ]);
    expect(selected?.source).toBe("inverter_available_power");
    expect(selected?.availablePowerKw).toBe(800);
  });

  it("does not treat equipment faults as recoverable grid curtailment", () => {
    const classification = classifyCurtailmentCause(
      {
        timestamp: "2026-07-19T12:00:00.000Z",
        actualPowerKw: 100,
        availableCandidates: [],
        inverterFault: true
      },
      {
        source: "inverter_available_power",
        availablePowerKw: 1000,
        confidence: 0.9,
        quality: "valid"
      }
    );
    expect(classification.cause).toBe("equipment_fault");
    expect(classification.recoverable).toBe(false);
  });

  it("classifies major recoverable and non-recoverable causes", () => {
    const evidence = {
      source: "inverter_available_power" as const,
      availablePowerKw: 1000,
      confidence: 0.9,
      quality: "valid" as const
    };
    expect(
      classifyCurtailmentCause(
        { timestamp: "t", actualPowerKw: 400, availableCandidates: [], gridInstruction: true },
        evidence
      ).cause
    ).toBe("grid_instruction");
    expect(
      classifyCurtailmentCause(
        { timestamp: "t", actualPowerKw: 400, availableCandidates: [], networkCongestion: true },
        evidence
      ).cause
    ).toBe("network_congestion");
    expect(
      classifyCurtailmentCause(
        { timestamp: "t", actualPowerKw: 400, availableCandidates: [], exportLimitKw: 400 },
        evidence
      ).cause
    ).toBe("export_limit");
    expect(
      classifyCurtailmentCause(
        { timestamp: "t", actualPowerKw: 300, availableCandidates: [], ppcSetpointKw: 300 },
        evidence
      ).cause
    ).toBe("ppc_limit");
    expect(
      classifyCurtailmentCause(
        { timestamp: "t", actualPowerKw: 200, availableCandidates: [], clippingKw: 800 },
        evidence
      ).recoverable
    ).toBe(false);
  });

  it("integrates energy with trapezoids", () => {
    const energy = integrateEnergyKwh([
      { timestampMs: Date.parse("2026-07-19T12:00:00.000Z"), powerKw: 100 },
      { timestampMs: Date.parse("2026-07-19T13:00:00.000Z"), powerKw: 100 }
    ]);
    expect(energy).toBe(100);
  });

  it("requires persistence before creating events and excludes unavailable inverters", () => {
    const samples: CurtailmentSample[] = [
      ...persistentExportLimitSamples(),
      {
        timestamp: "2026-07-19T12:15:00.000Z",
        actualPowerKw: 0,
        inverterUnavailable: true,
        availableCandidates: available(1000)
      }
    ];

    const events = detectCurtailmentEvents(samples, {
      minimumCurtailedPowerKw: 50,
      persistenceSamples: 3,
      mergeGapMs: 600000,
      calculationVersion: "curtailment-v1"
    });

    expect(events).toHaveLength(1);
    expect(events[0]?.cause).toBe("export_limit");
    expect(events[0]?.recoverableEnergyKwh).toBeGreaterThan(0);
  });

  it("merges adjacent events and zeros recoverable energy for equipment faults on replay", () => {
    const faultSamples: CurtailmentSample[] = [0, 5, 10, 20, 25, 30].map((minute) => ({
      timestamp: `2026-07-19T12:${String(minute).padStart(2, "0")}:00.000Z`,
      actualPowerKw: 100,
      inverterFault: true,
      availableCandidates: available(1000)
    }));

    const events = detectCurtailmentEvents(faultSamples, {
      minimumCurtailedPowerKw: 50,
      persistenceSamples: 3,
      mergeGapMs: 15 * 60 * 1000,
      calculationVersion: "curtailment-v1"
    });

    expect(events.length).toBeGreaterThanOrEqual(1);
    for (const event of events) {
      expect(event.cause).toBe("equipment_fault");
      expect(event.recoverableEnergyKwh).toBe(0);
      expect(event.estimatedLostEnergyKwh).toBeGreaterThan(0);
    }
  });

  it("replays synthetic historical export-limit data deterministically", () => {
    const samples = persistentExportLimitSamples();
    const first = detectCurtailmentEvents(samples);
    const second = detectCurtailmentEvents(samples);
    expect(first).toEqual(second);
    expect(first[0]?.calculationVersion).toBe("curtailment-v1");
  });
});

describe("forecast scoring", () => {
  it("calculates MAE RMSE MAPE and bias", () => {
    const score = scoreForecast([
      { timestamp: "t1", actualKw: 100, forecastKw: 110 },
      { timestamp: "t2", actualKw: 200, forecastKw: 180 }
    ]);
    expect(score.maeKw).toBe(15);
    expect(score.rmseKw).toBeCloseTo(15.8114, 3);
    expect(score.mapePercent).toBeCloseTo(10, 3);
    expect(score.biasKw).toBe(-5);
  });

  it("builds persistence baseline without inventing measured irradiance", () => {
    expect(persistenceBaselineKw([10, 20, 30])).toEqual([10, 10, 20]);
  });

  it("labels clear-sky baseline as estimated, never measured", () => {
    expect(CLEAR_SKY_SOURCE_TYPE).toBe("estimated");
    expect(clearSkyBaselineKw(1000, [0.5, 0.8])).toEqual([500, 800]);
  });
});
