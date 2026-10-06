import request from "supertest";

import { analyseRecoveryOpportunity, type RecoverySample } from "../src/domain/recovery-engine.js";
import { createApp } from "../src/app.js";
import { signAccessToken } from "../src/utils/jwt.js";

jest.mock("../src/lib/prisma.js", () => ({
  prisma: {
    $queryRaw: jest.fn().mockResolvedValue([{ one: 1 }]),
    recoveryAnalysisRun: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    },
    recoveryReview: {
      create: jest.fn()
    },
    plant: {
      findUnique: jest.fn()
    },
    telemetryReading: {
      findMany: jest.fn()
    },
    forecastRun: {
      findFirst: jest.fn()
    },
    $transaction: jest.fn()
  }
}));

const buildExportLimitedSamples = (count = 6): RecoverySample[] =>
  Array.from({ length: count }, (_, index) => ({
    timestamp: new Date(Date.UTC(2026, 9, 6, 8, index * 10)).toISOString(),
    expectedPowerKw: 700,
    actualPowerKw: 478,
    exportLimitKw: 480,
    irradianceWm2: 800,
    inverterAvailable: true,
    gridInstructionActive: false
  }));

describe("analyseRecoveryOpportunity", () => {
  it("classifies six export-limited intervals and computes material lost energy", () => {
    const result = analyseRecoveryOpportunity(buildExportLimitedSamples(6));

    expect(result.analysisMode).toBe("advisory_only");
    expect(result.algorithmVersion).toMatch(/^recovery-engine@/);
    expect(result.dominantCause).toBe("export_limit");
    expect(result.confidence).toBeGreaterThan(0.9);
    // 6 × (700 - 478) × (10/60) = 222 kWh
    expect(result.lostEnergyKwh).toBe(222);
    expect(result.affectedIntervals).toBe(6);
    expect(result.affectedDurationHours).toBe(1);
    expect(result.intervals).toHaveLength(6);
    expect(result.intervals.every((interval) => interval.material)).toBe(true);
    expect(result.opportunities).toHaveLength(3);
    expect(result.provenance.syntheticDemo).toBe(true);
    expect(result.annualFinancialModel.annualLostEnergyKwh).toBe(222 * 120);
  });

  it("excludes non-material gaps from lost energy and affected duration", () => {
    const samples: RecoverySample[] = [
      {
        timestamp: "2026-10-06T08:00:00.000Z",
        expectedPowerKw: 500,
        actualPowerKw: 495,
        irradianceWm2: 750,
        inverterAvailable: true,
        gridInstructionActive: false
      },
      {
        timestamp: "2026-10-06T08:10:00.000Z",
        expectedPowerKw: 700,
        actualPowerKw: 478,
        exportLimitKw: 480,
        irradianceWm2: 800,
        inverterAvailable: true,
        gridInstructionActive: false
      }
    ];

    const result = analyseRecoveryOpportunity(samples);
    expect(result.affectedIntervals).toBe(1);
    expect(result.affectedDurationHours).toBe(0.17);
    // Only the second interval contributes material loss: (700-478)*(10/60)=37
    expect(result.lostEnergyKwh).toBe(37);
    expect(result.grossGapEnergyKwh).toBeGreaterThan(result.lostEnergyKwh);
    expect(result.intervals[0]?.material).toBe(false);
    expect(result.intervals[1]?.material).toBe(true);
    // Flexible load capacity uses affected duration (10 min): min(37, 180*(10/60))=30
    const flexible = result.opportunities.find((option) => option.id === "flexible_load");
    expect(flexible?.recoverableEnergyKwh).toBe(30);
  });

  it("returns none when actual generation is within 5% of expected", () => {
    const samples: RecoverySample[] = [
      {
        timestamp: "2026-10-06T08:00:00.000Z",
        expectedPowerKw: 500,
        actualPowerKw: 490,
        irradianceWm2: 750,
        inverterAvailable: true,
        gridInstructionActive: false
      },
      {
        timestamp: "2026-10-06T08:10:00.000Z",
        expectedPowerKw: 510,
        actualPowerKw: 505,
        irradianceWm2: 760,
        inverterAvailable: true,
        gridInstructionActive: false
      }
    ];

    const result = analyseRecoveryOpportunity(samples);
    expect(result.dominantCause).toBe("none");
    expect(result.affectedIntervals).toBe(0);
    expect(result.affectedDurationHours).toBe(0);
    expect(result.lostEnergyKwh).toBe(0);
  });

  it("gives grid instruction precedence over export-limit signals", () => {
    const samples: RecoverySample[] = [
      {
        timestamp: "2026-10-06T09:00:00.000Z",
        expectedPowerKw: 700,
        actualPowerKw: 360,
        exportLimitKw: 480,
        irradianceWm2: 820,
        inverterAvailable: true,
        gridInstructionActive: true
      },
      {
        timestamp: "2026-10-06T09:10:00.000Z",
        expectedPowerKw: 690,
        actualPowerKw: 360,
        exportLimitKw: 480,
        irradianceWm2: 810,
        inverterAvailable: true,
        gridInstructionActive: true
      }
    ];

    const result = analyseRecoveryOpportunity(samples);
    expect(result.dominantCause).toBe("grid_instruction");
    expect(result.confidence).toBeGreaterThan(0.95);
  });

  it("classifies inverter unavailable as equipment fault", () => {
    const samples: RecoverySample[] = [
      {
        timestamp: "2026-10-06T10:00:00.000Z",
        expectedPowerKw: 650,
        actualPowerKw: 40,
        irradianceWm2: 790,
        inverterAvailable: false,
        gridInstructionActive: false
      }
    ];

    const result = analyseRecoveryOpportunity(samples);
    expect(result.dominantCause).toBe("equipment_fault");
    expect(result.causeLabel).toMatch(/equipment/i);
  });

  it("rejects an empty sample array", () => {
    expect(() => analyseRecoveryOpportunity([])).toThrow(/at least one/i);
  });
});

describe("POST /api/recovery/analyse", () => {
  const app = createApp();

  it("rejects unauthenticated requests", async () => {
    const response = await request(app)
      .post("/api/recovery/analyse")
      .send({ samples: buildExportLimitedSamples(1) });

    expect(response.status).toBe(401);
  });

  it("rejects more than 288 samples", async () => {
    const token = signAccessToken({
      sub: "user-1",
      email: "ops@gridflex.ai",
      name: "Ops",
      role: "operator"
    });

    const samples = Array.from({ length: 289 }, (_, index) => ({
      timestamp: new Date(Date.UTC(2026, 9, 6, 0, index)).toISOString(),
      expectedPowerKw: 100,
      actualPowerKw: 90
    }));

    const response = await request(app)
      .post("/api/recovery/analyse")
      .set("Authorization", `Bearer ${token}`)
      .send({ samples });

    expect(response.status).toBe(400);
  });

  it("returns advisory analysis for authenticated requests", async () => {
    const token = signAccessToken({
      sub: "user-1",
      email: "ops@gridflex.ai",
      name: "Ops",
      role: "operator"
    });

    const response = await request(app)
      .post("/api/recovery/analyse")
      .set("Authorization", `Bearer ${token}`)
      .send({
        samples: buildExportLimitedSamples(6),
        assumptions: { tariffZarPerKwh: 2.25 }
      });

    expect(response.status).toBe(200);
    expect(response.body.data.analysisMode).toBe("advisory_only");
    expect(response.body.data.dominantCause).toBe("export_limit");
    expect(response.body.data.lostEnergyKwh).toBe(222);
    expect(response.body.data.affectedDurationHours).toBe(1);
    expect(response.body.data.intervals).toHaveLength(6);
    expect(response.body.data.algorithmVersion).toMatch(/^recovery-engine@/);
  });
});
