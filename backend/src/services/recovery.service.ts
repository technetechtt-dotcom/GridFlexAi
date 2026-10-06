import {
  DataQuality,
  DataSourceType,
  Prisma,
  RecoveryAnalysisStatus,
  RecoveryCauseCode,
  TelemetryEnvironment,
  type RecoveryAnalysisRun
} from "@prisma/client";

import {
  analyseRecoveryOpportunity,
  RECOVERY_ALGORITHM_VERSION,
  type AnalyseRecoveryOptions,
  type RecoveryAnalysis,
  type RecoveryAssumptions,
  type RecoveryCause,
  type RecoverySample
} from "../domain/recovery-engine.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/AppError.js";
import { recordAuditLog } from "./audit-log.service.js";
import type { AccessActor } from "./access-scope.service.js";
import { getOptionalSiteAccessScope } from "./access-scope.service.js";

const toCauseCode = (cause: RecoveryCause): RecoveryCauseCode => {
  switch (cause) {
    case "grid_instruction":
      return RecoveryCauseCode.grid_instruction;
    case "equipment_fault":
      return RecoveryCauseCode.equipment_fault;
    case "export_limit":
      return RecoveryCauseCode.export_limit;
    case "weather":
      return RecoveryCauseCode.weather;
    case "performance_gap":
      return RecoveryCauseCode.performance_gap;
    default:
      return RecoveryCauseCode.none;
  }
};

const toEnvironment = (
  dataEnvironment: RecoveryAnalysis["provenance"]["dataEnvironment"]
): TelemetryEnvironment => {
  if (dataEnvironment === "live") return TelemetryEnvironment.live;
  if (dataEnvironment === "hil") return TelemetryEnvironment.hil;
  return TelemetryEnvironment.simulation;
};

const assertPlantAccess = async (plantId: string, actor?: AccessActor) => {
  const scope = await getOptionalSiteAccessScope(actor);
  const plant = await prisma.plant.findUnique({ where: { id: plantId } });
  if (!plant) throw new AppError("Plant not found.", 404);
  if (scope.kind === "site" && plant.siteId !== scope.siteId) {
    throw new AppError("Cross-tenant plant access denied.", 403);
  }
  return plant;
};

const bucketMs = (intervalMinutes: number) => intervalMinutes * 60 * 1000;

/** Assemble expected (forecast p50) vs actual (telemetry active_power_kw) samples for a plant window. */
export const assembleRecoverySamplesFromPlant = async (input: {
  plantId: string;
  from: string;
  to: string;
  intervalMinutes?: number;
  actor?: AccessActor;
}): Promise<{
  samples: RecoverySample[];
  dataEnvironment: "live" | "simulation" | "hil";
  plant: { id: string; organisationId: string; siteId: string; exportCapacityKw: number; dataSourceType: DataSourceType };
}> => {
  const plant = await assertPlantAccess(input.plantId, input.actor);
  const from = new Date(input.from);
  const to = new Date(input.to);
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || to <= from) {
    throw new AppError("Invalid recovery window: from/to must be valid datetimes with to > from.", 400);
  }
  const intervalMinutes = input.intervalMinutes ?? 10;
  if (intervalMinutes < 1 || intervalMinutes > 60) {
    throw new AppError("intervalMinutes must be between 1 and 60.", 400);
  }

  const [telemetry, latestForecast] = await Promise.all([
    prisma.telemetryReading.findMany({
      where: {
        plantId: plant.id,
        key: "active_power_kw",
        deviceTimestamp: { gte: from, lte: to },
        environment: {
          in:
            plant.dataSourceType === DataSourceType.simulated
              ? [TelemetryEnvironment.simulation]
              : [TelemetryEnvironment.live, TelemetryEnvironment.hil]
        }
      },
      orderBy: { deviceTimestamp: "asc" },
      take: 5000
    }),
    prisma.forecastRun.findFirst({
      where: {
        plantId: plant.id,
        validFrom: { lte: to },
        validTo: { gte: from }
      },
      orderBy: { generatedAt: "desc" },
      include: {
        values: {
          where: { targetTime: { gte: from, lte: to } },
          orderBy: { targetTime: "asc" }
        }
      }
    })
  ]);

  if (telemetry.length === 0) {
    throw new AppError("No active_power_kw telemetry found for the requested plant window.", 404);
  }
  if (!latestForecast || latestForecast.values.length === 0) {
    throw new AppError("No forecast values found for the requested plant window.", 404);
  }

  const step = bucketMs(intervalMinutes);
  const actualByBucket = new Map<number, { sum: number; count: number; quality: DataQuality; source: DataSourceType }>();
  for (const row of telemetry) {
    if (typeof row.numericValue !== "number" || !Number.isFinite(row.numericValue)) continue;
    const bucket = Math.floor(row.deviceTimestamp.getTime() / step) * step;
    const current = actualByBucket.get(bucket) ?? {
      sum: 0,
      count: 0,
      quality: row.quality,
      source: row.sourceType
    };
    current.sum += row.numericValue;
    current.count += 1;
    actualByBucket.set(bucket, current);
  }

  const expectedByBucket = new Map<number, { value: number; quality: DataQuality; source: DataSourceType }>();
  for (const value of latestForecast.values) {
    const bucket = Math.floor(value.targetTime.getTime() / step) * step;
    expectedByBucket.set(bucket, {
      value: value.p50Kw,
      quality: value.quality,
      source: value.sourceType
    });
  }

  const buckets = [...actualByBucket.keys()].filter((bucket) => expectedByBucket.has(bucket)).sort((a, b) => a - b);
  if (buckets.length === 0) {
    throw new AppError("Forecast and telemetry buckets do not overlap for this window.", 422);
  }

  const samples: RecoverySample[] = buckets.slice(0, 288).map((bucket) => {
    const actual = actualByBucket.get(bucket)!;
    const expected = expectedByBucket.get(bucket)!;
    const sample: RecoverySample = {
      timestamp: new Date(bucket).toISOString(),
      expectedPowerKw: expected.value,
      actualPowerKw: actual.sum / actual.count,
      expectedSourceType: "forecast",
      actualSourceType:
        actual.source === DataSourceType.measured
          ? "measured"
          : actual.source === DataSourceType.simulated
            ? "simulated"
            : "calculated",
      quality:
        actual.quality === DataQuality.valid
          ? "valid"
          : actual.quality === DataQuality.uncertain
            ? "uncertain"
            : actual.quality === DataQuality.stale
              ? "stale"
              : "unverified"
    };
    if (plant.exportCapacityKw > 0) {
      sample.exportLimitKw = plant.exportCapacityKw;
    }
    return sample;
  });

  const dataEnvironment: "live" | "simulation" | "hil" =
    plant.dataSourceType === DataSourceType.simulated
      ? "simulation"
      : telemetry.some((row) => row.environment === TelemetryEnvironment.hil)
        ? "hil"
        : "live";

  return {
    samples,
    dataEnvironment,
    plant: {
      id: plant.id,
      organisationId: plant.organisationId,
      siteId: plant.siteId,
      exportCapacityKw: plant.exportCapacityKw,
      dataSourceType: plant.dataSourceType
    }
  };
};

export const runRecoveryAnalysis = (
  samples: RecoverySample[],
  options?: AnalyseRecoveryOptions
): RecoveryAnalysis => analyseRecoveryOpportunity(samples, options);

export const persistRecoveryAnalysis = async (input: {
  analysis: RecoveryAnalysis;
  organisationId: string;
  siteId?: string | null;
  plantId?: string | null;
  actorId?: string;
}): Promise<RecoveryAnalysisRun> => {
  if (input.analysis.provenance.syntheticDemo) {
    // Allow demo persistence only into simulation environment with explicit org.
  }

  const windowStart = new Date(input.analysis.intervals[0]?.timestamp ?? Date.now());
  const windowEnd = new Date(
    input.analysis.intervals[input.analysis.intervals.length - 1]?.timestamp ?? Date.now()
  );

  const created = await prisma.recoveryAnalysisRun.create({
    data: {
      organisationId: input.organisationId,
      siteId: input.siteId ?? null,
      plantId: input.plantId ?? null,
      environment: toEnvironment(input.analysis.provenance.dataEnvironment),
      status: RecoveryAnalysisStatus.open,
      dominantCause: toCauseCode(input.analysis.dominantCause),
      causeConfidence: input.analysis.confidence,
      algorithmVersion: input.analysis.algorithmVersion || RECOVERY_ALGORITHM_VERSION,
      windowStart,
      windowEnd,
      expectedEnergyKwh: input.analysis.expectedEnergyKwh,
      actualEnergyKwh: input.analysis.actualEnergyKwh,
      lostEnergyKwh: input.analysis.lostEnergyKwh,
      revenueAtRiskZar: input.analysis.revenueAtRiskZar,
      carbonOpportunityKg: input.analysis.carbonOpportunityKg,
      affectedIntervals: input.analysis.affectedIntervals,
      affectedDurationHours: input.analysis.affectedDurationHours,
      assumptionsJson: input.analysis.assumptions as unknown as Prisma.InputJsonValue,
      analysisJson: input.analysis as unknown as Prisma.InputJsonValue,
      provenanceJson: input.analysis.provenance as unknown as Prisma.InputJsonValue,
      recommendation: input.analysis.recommendation,
      createdById: input.actorId ?? null,
      evidence: {
        create: input.analysis.intervals.flatMap((interval) => [
          {
            timestamp: new Date(interval.timestamp),
            sourceType: DataSourceType.forecast,
            measurementKey: "expected_power_kw",
            numericValue: interval.expectedPowerKw,
            quality: DataQuality.unverified,
            provenanceNote: input.analysis.provenance.expectedSourceSummary
          },
          {
            timestamp: new Date(interval.timestamp),
            sourceType:
              input.analysis.provenance.syntheticDemo
                ? DataSourceType.simulated
                : DataSourceType.measured,
            measurementKey: "actual_power_kw",
            numericValue: interval.actualPowerKw,
            quality: DataQuality.unverified,
            provenanceNote: input.analysis.provenance.actualSourceSummary
          }
        ])
      },
      opportunities: {
        create: input.analysis.opportunities.map((opportunity) => ({
          opportunityType: opportunity.id,
          label: opportunity.label,
          recoverableEnergyKwh: opportunity.recoverableEnergyKwh,
          estimatedGrossValueZar: opportunity.estimatedGrossValueZar,
          ranking: opportunity.ranking,
          readiness: opportunity.readiness,
          notes: opportunity.notes
        }))
      }
    },
    include: {
      evidence: true,
      opportunities: { orderBy: { ranking: "asc" } },
      reviews: true
    }
  });

  await recordAuditLog({
    action: "recovery.analysis.persisted",
    entityType: "RecoveryAnalysisRun",
    entityId: created.id,
    message: `Persisted recovery analysis ${created.id} (${created.dominantCause})`,
    userId: input.actorId,
    metadata: {
      algorithmVersion: created.algorithmVersion,
      lostEnergyKwh: created.lostEnergyKwh,
      environment: created.environment
    }
  });

  return created;
};

export const listRecoveryAnalyses = async (
  filters: {
    plantId?: string;
    siteId?: string;
    status?: RecoveryAnalysisStatus;
    limit?: number;
  },
  actor?: AccessActor
) => {
  const scope = await getOptionalSiteAccessScope(actor);
  const where: Prisma.RecoveryAnalysisRunWhereInput = {};
  if (scope.kind === "site") where.siteId = scope.siteId;
  else if (filters.siteId) where.siteId = filters.siteId;
  if (filters.plantId) where.plantId = filters.plantId;
  if (filters.status) where.status = filters.status;

  return prisma.recoveryAnalysisRun.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    take: Math.min(filters.limit ?? 50, 200),
    include: {
      plant: { select: { id: true, name: true, code: true, dataSourceType: true } },
      site: { select: { id: true, name: true, code: true } },
      opportunities: { orderBy: { ranking: "asc" } },
      reviews: { orderBy: { createdAt: "desc" }, take: 5 }
    }
  });
};

export const getRecoveryAnalysis = async (analysisId: string, actor?: AccessActor) => {
  const scope = await getOptionalSiteAccessScope(actor);
  const row = await prisma.recoveryAnalysisRun.findUnique({
    where: { id: analysisId },
    include: {
      plant: { select: { id: true, name: true, code: true, dataSourceType: true } },
      site: { select: { id: true, name: true, code: true } },
      evidence: { orderBy: { timestamp: "asc" }, take: 600 },
      opportunities: { orderBy: { ranking: "asc" } },
      reviews: { orderBy: { createdAt: "desc" } }
    }
  });
  if (!row) throw new AppError("Recovery analysis not found.", 404);
  if (scope.kind === "site" && row.siteId !== scope.siteId) {
    throw new AppError("Cross-tenant recovery analysis access denied.", 403);
  }
  return row;
};

export const reviewRecoveryAnalysis = async (input: {
  analysisId: string;
  decision: RecoveryAnalysisStatus;
  notes: string;
  correctedCause?: RecoveryCauseCode;
  actorId: string;
  actor?: AccessActor;
}) => {
  const existing = await getRecoveryAnalysis(input.analysisId, input.actor);
  if (!["under_review", "confirmed", "dismissed"].includes(input.decision)) {
    throw new AppError("decision must be under_review, confirmed, or dismissed.", 400);
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.recoveryReview.create({
      data: {
        analysisId: existing.id,
        reviewerId: input.actorId,
        decision: input.decision,
        correctedCause: input.correctedCause ?? null,
        notes: input.notes
      }
    });
    return tx.recoveryAnalysisRun.update({
      where: { id: existing.id },
      data: {
        status: input.decision,
        ...(input.correctedCause ? { dominantCause: input.correctedCause } : {})
      },
      include: {
        reviews: { orderBy: { createdAt: "desc" } },
        opportunities: { orderBy: { ranking: "asc" } }
      }
    });
  });

  await recordAuditLog({
    action: "recovery.analysis.reviewed",
    entityType: "RecoveryAnalysisRun",
    entityId: existing.id,
    message: `Recovery analysis ${existing.id} marked ${input.decision}`,
    userId: input.actorId,
    metadata: { decision: input.decision, correctedCause: input.correctedCause ?? null }
  });

  return updated;
};

export const buildRecoveryReportCsv = (analysis: RecoveryAnalysis): string => {
  const lines = [
    "section,key,value",
    `meta,algorithmVersion,${analysis.algorithmVersion}`,
    `meta,analysisMode,${analysis.analysisMode}`,
    `meta,dominantCause,${analysis.dominantCause}`,
    `meta,confidence,${analysis.confidence}`,
    `meta,lostEnergyKwh,${analysis.lostEnergyKwh}`,
    `meta,affectedDurationHours,${analysis.affectedDurationHours}`,
    `meta,revenueAtRiskZar,${analysis.revenueAtRiskZar}`,
    `meta,carbonOpportunityKg,${analysis.carbonOpportunityKg}`,
    `meta,dataEnvironment,${analysis.provenance.dataEnvironment}`,
    `meta,syntheticDemo,${analysis.provenance.syntheticDemo}`,
    ...analysis.opportunities.map(
      (option) =>
        `opportunity,${option.id},${option.estimatedGrossValueZar}|${option.recoverableEnergyKwh}|${option.ranking}`
    ),
    ...analysis.intervals.map(
      (interval) =>
        `interval,${interval.timestamp},${interval.expectedPowerKw}|${interval.actualPowerKw}|${interval.lostEnergyKwh}|${interval.cause}|${interval.material}`
    )
  ];
  return `${lines.join("\n")}\n`;
};

export const buildRecoveryReportHtml = (analysis: RecoveryAnalysis, title = "GridFlex AI Recovery Report"): string => {
  const opportunityRows = analysis.opportunities
    .map(
      (option) =>
        `<tr><td>${option.ranking}</td><td>${option.label}</td><td>${option.recoverableEnergyKwh}</td><td>R ${option.estimatedGrossValueZar.toFixed(2)}</td></tr>`
    )
    .join("");
  const intervalRows = analysis.intervals
    .map(
      (interval) =>
        `<tr><td>${interval.timestamp}</td><td>${interval.expectedPowerKw}</td><td>${interval.actualPowerKw}</td><td>${interval.lostEnergyKwh}</td><td>${interval.causeLabel}</td><td>${interval.material ? "yes" : "no"}</td></tr>`
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    body { font-family: Georgia, "Times New Roman", serif; color: #0f172a; margin: 32px; }
    h1 { color: #065f46; margin-bottom: 4px; }
    .banner { background: #ecfdf5; border: 1px solid #6ee7b7; padding: 12px 16px; margin: 16px 0; }
    .kpi { display: inline-block; min-width: 140px; margin: 8px 16px 8px 0; }
    table { border-collapse: collapse; width: 100%; margin-top: 12px; font-size: 13px; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
    th { background: #f1f5f9; }
    .muted { color: #64748b; font-size: 12px; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p class="muted">Algorithm ${analysis.algorithmVersion} · Advisory only · Physical execution disabled</p>
  <div class="banner"><strong>${analysis.causeLabel}</strong> (confidence ${(analysis.confidence * 100).toFixed(0)}%) — ${analysis.recommendation}</div>
  <div>
    <div class="kpi"><strong>${analysis.lostEnergyKwh}</strong><br/>kWh material loss</div>
    <div class="kpi"><strong>R ${analysis.revenueAtRiskZar.toFixed(2)}</strong><br/>revenue at risk</div>
    <div class="kpi"><strong>${analysis.affectedDurationHours}</strong><br/>affected hours</div>
    <div class="kpi"><strong>${analysis.carbonOpportunityKg}</strong><br/>kg CO₂e opportunity</div>
  </div>
  <h2>Recovery options</h2>
  <table><thead><tr><th>#</th><th>Option</th><th>kWh</th><th>Gross value</th></tr></thead><tbody>${opportunityRows}</tbody></table>
  <h2>Annual financial sketch</h2>
  <p>Assumed event-days/year: ${analysis.annualFinancialModel.assumedEventDaysPerYear}. Top-option annual gross value: R ${analysis.annualFinancialModel.topOptionAnnualGrossValueZar.toFixed(2)}. Simple payback: ${analysis.annualFinancialModel.simplePaybackYears ?? "n/a"} years.</p>
  <p class="muted">${analysis.annualFinancialModel.notes}</p>
  <h2>Interval detail</h2>
  <table><thead><tr><th>Timestamp</th><th>Expected kW</th><th>Actual kW</th><th>Material lost kWh</th><th>Cause</th><th>Material</th></tr></thead><tbody>${intervalRows}</tbody></table>
  <p class="muted">Provenance: ${analysis.provenance.dataEnvironment} · expected ${analysis.provenance.expectedSourceSummary} · actual ${analysis.provenance.actualSourceSummary}</p>
</body>
</html>`;
};

export type { RecoveryAssumptions };
