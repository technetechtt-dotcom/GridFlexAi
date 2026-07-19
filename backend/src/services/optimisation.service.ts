import { Prisma, type DataSourceType } from "@prisma/client";

import {
  defaultBessConfiguration,
  defaultElectrolyserConfiguration,
  defaultSimulatedBessState,
  defaultSimulatedElectrolyserState,
  hasBlockingViolations,
  validateBessConfiguration,
  validateElectrolyserConfiguration,
  type BessConfiguration,
  type ElectrolyserConfiguration
} from "../domain/flexible-assets/index.js";
import { provenanced } from "../domain/flexible-assets/provenance-value.js";
import {
  defaultAdvisoryEngine,
  OPTIMISATION_SOLVER_VERSION,
  type OptimisationHorizonInterval,
  type OptimisationProblem,
  type OptimisationWeights
} from "../domain/optimisation/index.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/AppError.js";
import type { AccessActor } from "./access-scope.service.js";
import { getOptionalSiteAccessScope } from "./access-scope.service.js";

const DEFAULT_WEIGHTS: OptimisationWeights = {
  exportRevenueZarPerMwh: 1450,
  hydrogenRevenueZarPerKg: 85,
  curtailmentAvoidanceZarPerMwh: 900,
  degradationCostZarPerMwh: 120,
  electrolyserOperatingCostZarPerHour: 400
};

const assertAssetAccess = async (assetId: string, actor?: AccessActor) => {
  const scope = await getOptionalSiteAccessScope(actor);
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    include: {
      plant: { select: { id: true, siteId: true, organisationId: true, name: true, code: true } }
    }
  });
  if (!asset) throw new AppError("Asset not found.", 404);
  if (scope.kind === "site" && asset.plant.siteId !== scope.siteId) {
    throw new AppError("Cross-tenant asset access denied.", 403);
  }
  return asset;
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

const mapBessConfig = (row: {
  assetId: string;
  ratedPowerKw: number;
  ratedEnergyKwh: number;
  minSocPercent: number;
  maxSocPercent: number;
  chargeEfficiency: number;
  dischargeEfficiency: number;
  maxChargePowerKw: number;
  maxDischargePowerKw: number;
  rampLimitKwPerMin: number;
  degradationCostZarPerMwh: number;
  reserveSocPercent: number;
  minOperatingTempC: number | null;
  maxOperatingTempC: number | null;
  warrantyCycleLimit: number | null;
  simulationMode: boolean;
  configSource: DataSourceType;
}): BessConfiguration => ({
  assetId: row.assetId,
  ratedPowerKw: provenanced(row.ratedPowerKw, row.configSource),
  ratedEnergyKwh: provenanced(row.ratedEnergyKwh, row.configSource),
  minSocPercent: provenanced(row.minSocPercent, row.configSource),
  maxSocPercent: provenanced(row.maxSocPercent, row.configSource),
  chargeEfficiency: provenanced(row.chargeEfficiency, row.configSource),
  dischargeEfficiency: provenanced(row.dischargeEfficiency, row.configSource),
  maxChargePowerKw: provenanced(row.maxChargePowerKw, row.configSource),
  maxDischargePowerKw: provenanced(row.maxDischargePowerKw, row.configSource),
  rampLimitKwPerMin: provenanced(row.rampLimitKwPerMin, row.configSource),
  degradationCostZarPerMwh: provenanced(row.degradationCostZarPerMwh, row.configSource),
  reserveSocPercent: provenanced(row.reserveSocPercent, row.configSource),
  minOperatingTempC: provenanced(row.minOperatingTempC, row.configSource),
  maxOperatingTempC: provenanced(row.maxOperatingTempC, row.configSource),
  warrantyCycleLimit: provenanced(row.warrantyCycleLimit, row.configSource),
  simulationMode: row.simulationMode,
  configSource: row.configSource
});

const mapElectrolyserConfig = (row: {
  assetId: string;
  technology: string;
  minStableLoadKw: number;
  maxLoadKw: number;
  rampRateKwPerMin: number;
  startUpTimeMin: number;
  shutDownTimeMin: number;
  minRunTimeMin: number;
  efficiencyKwhPerKg: number;
  waterLitresPerKg: number;
  hydrogenStorageCapacityKg: number;
  hydrogenSalePriceZarPerKg: number;
  operatingCostZarPerHour: number;
  minOperatingTempC: number | null;
  maxOperatingTempC: number | null;
  maintenanceWindowActive: boolean;
  simulationMode: boolean;
  configSource: DataSourceType;
}): ElectrolyserConfiguration => ({
  assetId: row.assetId,
  technology: provenanced(
    (row.technology as ElectrolyserConfiguration["technology"]["value"]) || "unspecified",
    row.configSource
  ),
  minStableLoadKw: provenanced(row.minStableLoadKw, row.configSource),
  maxLoadKw: provenanced(row.maxLoadKw, row.configSource),
  rampRateKwPerMin: provenanced(row.rampRateKwPerMin, row.configSource),
  startUpTimeMin: provenanced(row.startUpTimeMin, row.configSource),
  shutDownTimeMin: provenanced(row.shutDownTimeMin, row.configSource),
  minRunTimeMin: provenanced(row.minRunTimeMin, row.configSource),
  efficiencyKwhPerKg: provenanced(row.efficiencyKwhPerKg, row.configSource),
  waterLitresPerKg: provenanced(row.waterLitresPerKg, row.configSource),
  hydrogenStorageCapacityKg: provenanced(row.hydrogenStorageCapacityKg, row.configSource),
  hydrogenSalePriceZarPerKg: provenanced(row.hydrogenSalePriceZarPerKg, row.configSource),
  operatingCostZarPerHour: provenanced(row.operatingCostZarPerHour, row.configSource),
  minOperatingTempC: provenanced(row.minOperatingTempC, row.configSource),
  maxOperatingTempC: provenanced(row.maxOperatingTempC, row.configSource),
  maintenanceWindowActive: provenanced(row.maintenanceWindowActive, row.configSource),
  simulationMode: row.simulationMode,
  configSource: row.configSource
});

export const getBessModel = async (assetId: string, actor?: AccessActor) => {
  await assertAssetAccess(assetId, actor);
  const [configRow, stateRow] = await Promise.all([
    prisma.bessModelConfig.findUnique({ where: { assetId } }),
    prisma.bessOperatingState.findUnique({ where: { assetId } })
  ]);
  const config = configRow ? mapBessConfig(configRow) : defaultBessConfiguration(assetId);
  const state = stateRow
    ? {
        assetId,
        socPercent: provenanced(stateRow.socPercent, stateRow.socSource, stateRow.socQuality),
        temperatureC: provenanced(stateRow.temperatureC, stateRow.socSource, stateRow.socQuality),
        chargePowerKw: provenanced(stateRow.chargePowerKw, stateRow.socSource, stateRow.socQuality),
        dischargePowerKw: provenanced(
          stateRow.dischargePowerKw,
          stateRow.socSource,
          stateRow.socQuality
        ),
        availableChargePowerKw: provenanced(
          stateRow.availableChargePowerKw,
          stateRow.socSource,
          stateRow.socQuality
        ),
        availableDischargePowerKw: provenanced(
          stateRow.availableDischargePowerKw,
          stateRow.socSource,
          stateRow.socQuality
        ),
        cycleCount: provenanced(stateRow.cycleCount, stateRow.socSource, stateRow.socQuality),
        alarmState: provenanced(stateRow.alarmState, stateRow.socSource, stateRow.socQuality),
        operatingState: provenanced(stateRow.operatingState, stateRow.socSource, stateRow.socQuality),
        simulationMode: stateRow.simulationMode
      }
    : defaultSimulatedBessState(assetId);

  return {
    configuration: config,
    state,
    violations: validateBessConfiguration(config),
    advisory: true as const,
    physicalControl: false as const
  };
};

export const upsertBessConfiguration = async (
  assetId: string,
  input: Partial<{
    ratedPowerKw: number;
    ratedEnergyKwh: number;
    minSocPercent: number;
    maxSocPercent: number;
    chargeEfficiency: number;
    dischargeEfficiency: number;
    maxChargePowerKw: number;
    maxDischargePowerKw: number;
    rampLimitKwPerMin: number;
    degradationCostZarPerMwh: number;
    reserveSocPercent: number;
    minOperatingTempC: number | null;
    maxOperatingTempC: number | null;
    warrantyCycleLimit: number | null;
    simulationMode: boolean;
    configSource: DataSourceType;
  }>,
  actor?: AccessActor
) => {
  await assertAssetAccess(assetId, actor);
  const defaults = defaultBessConfiguration(assetId);
  const source = input.configSource ?? defaults.configSource;
  const draft: BessConfiguration = {
    ...defaults,
    ratedPowerKw: provenanced(input.ratedPowerKw ?? defaults.ratedPowerKw.value, source),
    ratedEnergyKwh: provenanced(input.ratedEnergyKwh ?? defaults.ratedEnergyKwh.value, source),
    minSocPercent: provenanced(input.minSocPercent ?? defaults.minSocPercent.value, source),
    maxSocPercent: provenanced(input.maxSocPercent ?? defaults.maxSocPercent.value, source),
    chargeEfficiency: provenanced(input.chargeEfficiency ?? defaults.chargeEfficiency.value, source),
    dischargeEfficiency: provenanced(
      input.dischargeEfficiency ?? defaults.dischargeEfficiency.value,
      source
    ),
    maxChargePowerKw: provenanced(input.maxChargePowerKw ?? defaults.maxChargePowerKw.value, source),
    maxDischargePowerKw: provenanced(
      input.maxDischargePowerKw ?? defaults.maxDischargePowerKw.value,
      source
    ),
    rampLimitKwPerMin: provenanced(input.rampLimitKwPerMin ?? defaults.rampLimitKwPerMin.value, source),
    degradationCostZarPerMwh: provenanced(
      input.degradationCostZarPerMwh ?? defaults.degradationCostZarPerMwh.value,
      source
    ),
    reserveSocPercent: provenanced(input.reserveSocPercent ?? defaults.reserveSocPercent.value, source),
    minOperatingTempC: provenanced(
      input.minOperatingTempC !== undefined ? input.minOperatingTempC : defaults.minOperatingTempC.value,
      source
    ),
    maxOperatingTempC: provenanced(
      input.maxOperatingTempC !== undefined ? input.maxOperatingTempC : defaults.maxOperatingTempC.value,
      source
    ),
    warrantyCycleLimit: provenanced(
      input.warrantyCycleLimit !== undefined
        ? input.warrantyCycleLimit
        : defaults.warrantyCycleLimit.value,
      source
    ),
    simulationMode: input.simulationMode ?? true,
    configSource: source
  };

  const violations = validateBessConfiguration(draft);
  if (hasBlockingViolations(violations)) {
    throw new AppError(
      `Invalid BESS configuration: ${violations[0]?.message ?? "constraint violation"}`,
      400
    );
  }

  const row = await prisma.bessModelConfig.upsert({
    where: { assetId },
    create: {
      assetId,
      ratedPowerKw: draft.ratedPowerKw.value,
      ratedEnergyKwh: draft.ratedEnergyKwh.value,
      minSocPercent: draft.minSocPercent.value,
      maxSocPercent: draft.maxSocPercent.value,
      chargeEfficiency: draft.chargeEfficiency.value,
      dischargeEfficiency: draft.dischargeEfficiency.value,
      maxChargePowerKw: draft.maxChargePowerKw.value,
      maxDischargePowerKw: draft.maxDischargePowerKw.value,
      rampLimitKwPerMin: draft.rampLimitKwPerMin.value,
      degradationCostZarPerMwh: draft.degradationCostZarPerMwh.value,
      reserveSocPercent: draft.reserveSocPercent.value,
      minOperatingTempC: draft.minOperatingTempC.value,
      maxOperatingTempC: draft.maxOperatingTempC.value,
      warrantyCycleLimit: draft.warrantyCycleLimit.value,
      simulationMode: draft.simulationMode,
      configSource: draft.configSource
    },
    update: {
      ratedPowerKw: draft.ratedPowerKw.value,
      ratedEnergyKwh: draft.ratedEnergyKwh.value,
      minSocPercent: draft.minSocPercent.value,
      maxSocPercent: draft.maxSocPercent.value,
      chargeEfficiency: draft.chargeEfficiency.value,
      dischargeEfficiency: draft.dischargeEfficiency.value,
      maxChargePowerKw: draft.maxChargePowerKw.value,
      maxDischargePowerKw: draft.maxDischargePowerKw.value,
      rampLimitKwPerMin: draft.rampLimitKwPerMin.value,
      degradationCostZarPerMwh: draft.degradationCostZarPerMwh.value,
      reserveSocPercent: draft.reserveSocPercent.value,
      minOperatingTempC: draft.minOperatingTempC.value,
      maxOperatingTempC: draft.maxOperatingTempC.value,
      warrantyCycleLimit: draft.warrantyCycleLimit.value,
      simulationMode: draft.simulationMode,
      configSource: draft.configSource
    }
  });

  return { configuration: mapBessConfig(row), violations, advisory: true as const };
};

export const getElectrolyserModel = async (assetId: string, actor?: AccessActor) => {
  await assertAssetAccess(assetId, actor);
  const [configRow, stateRow] = await Promise.all([
    prisma.electrolyserModelConfig.findUnique({ where: { assetId } }),
    prisma.electrolyserOperatingState.findUnique({ where: { assetId } })
  ]);
  const configuration = configRow
    ? mapElectrolyserConfig(configRow)
    : defaultElectrolyserConfiguration(assetId);
  const state = stateRow
    ? {
        assetId,
        loadPowerKw: provenanced(stateRow.loadPowerKw, stateRow.loadSource, stateRow.loadQuality),
        productionKgPerHour: provenanced(
          stateRow.productionKgPerHour,
          stateRow.loadSource,
          stateRow.loadQuality
        ),
        storageLevelKg: provenanced(stateRow.storageLevelKg, stateRow.loadSource, stateRow.loadQuality),
        waterFlowLitrePerHour: provenanced(
          stateRow.waterFlowLitrePerHour,
          stateRow.loadSource,
          stateRow.loadQuality
        ),
        stackTemperatureC: provenanced(
          stateRow.stackTemperatureC,
          stateRow.loadSource,
          stateRow.loadQuality
        ),
        operatingMode: provenanced(stateRow.operatingMode, stateRow.loadSource, stateRow.loadQuality),
        alarmState: provenanced(stateRow.alarmState, stateRow.loadSource, stateRow.loadQuality),
        runTimeMinutes: provenanced(stateRow.runTimeMinutes, stateRow.loadSource, stateRow.loadQuality),
        simulationMode: stateRow.simulationMode
      }
    : defaultSimulatedElectrolyserState(assetId);

  return {
    configuration,
    state,
    violations: validateElectrolyserConfiguration(configuration),
    advisory: true as const,
    physicalControl: false as const
  };
};

export const upsertElectrolyserConfiguration = async (
  assetId: string,
  input: Partial<{
    technology: string;
    minStableLoadKw: number;
    maxLoadKw: number;
    rampRateKwPerMin: number;
    startUpTimeMin: number;
    shutDownTimeMin: number;
    minRunTimeMin: number;
    efficiencyKwhPerKg: number;
    waterLitresPerKg: number;
    hydrogenStorageCapacityKg: number;
    hydrogenSalePriceZarPerKg: number;
    operatingCostZarPerHour: number;
    minOperatingTempC: number | null;
    maxOperatingTempC: number | null;
    maintenanceWindowActive: boolean;
    simulationMode: boolean;
    configSource: DataSourceType;
  }>,
  actor?: AccessActor
) => {
  await assertAssetAccess(assetId, actor);
  const defaults = defaultElectrolyserConfiguration(assetId);
  const source = input.configSource ?? defaults.configSource;
  const draft: ElectrolyserConfiguration = {
    ...defaults,
    technology: provenanced(
      (input.technology as ElectrolyserConfiguration["technology"]["value"]) ??
        defaults.technology.value,
      source
    ),
    minStableLoadKw: provenanced(input.minStableLoadKw ?? defaults.minStableLoadKw.value, source),
    maxLoadKw: provenanced(input.maxLoadKw ?? defaults.maxLoadKw.value, source),
    rampRateKwPerMin: provenanced(input.rampRateKwPerMin ?? defaults.rampRateKwPerMin.value, source),
    startUpTimeMin: provenanced(input.startUpTimeMin ?? defaults.startUpTimeMin.value, source),
    shutDownTimeMin: provenanced(input.shutDownTimeMin ?? defaults.shutDownTimeMin.value, source),
    minRunTimeMin: provenanced(input.minRunTimeMin ?? defaults.minRunTimeMin.value, source),
    efficiencyKwhPerKg: provenanced(
      input.efficiencyKwhPerKg ?? defaults.efficiencyKwhPerKg.value,
      source
    ),
    waterLitresPerKg: provenanced(input.waterLitresPerKg ?? defaults.waterLitresPerKg.value, source),
    hydrogenStorageCapacityKg: provenanced(
      input.hydrogenStorageCapacityKg ?? defaults.hydrogenStorageCapacityKg.value,
      source
    ),
    hydrogenSalePriceZarPerKg: provenanced(
      input.hydrogenSalePriceZarPerKg ?? defaults.hydrogenSalePriceZarPerKg.value,
      source
    ),
    operatingCostZarPerHour: provenanced(
      input.operatingCostZarPerHour ?? defaults.operatingCostZarPerHour.value,
      source
    ),
    minOperatingTempC: provenanced(
      input.minOperatingTempC !== undefined ? input.minOperatingTempC : defaults.minOperatingTempC.value,
      source
    ),
    maxOperatingTempC: provenanced(
      input.maxOperatingTempC !== undefined ? input.maxOperatingTempC : defaults.maxOperatingTempC.value,
      source
    ),
    maintenanceWindowActive: provenanced(
      input.maintenanceWindowActive ?? defaults.maintenanceWindowActive.value,
      source
    ),
    simulationMode: input.simulationMode ?? true,
    configSource: source
  };

  const violations = validateElectrolyserConfiguration(draft);
  if (hasBlockingViolations(violations)) {
    throw new AppError(
      `Invalid electrolyser configuration: ${violations[0]?.message ?? "constraint violation"}`,
      400
    );
  }

  const row = await prisma.electrolyserModelConfig.upsert({
    where: { assetId },
    create: {
      assetId,
      technology: draft.technology.value,
      minStableLoadKw: draft.minStableLoadKw.value,
      maxLoadKw: draft.maxLoadKw.value,
      rampRateKwPerMin: draft.rampRateKwPerMin.value,
      startUpTimeMin: draft.startUpTimeMin.value,
      shutDownTimeMin: draft.shutDownTimeMin.value,
      minRunTimeMin: draft.minRunTimeMin.value,
      efficiencyKwhPerKg: draft.efficiencyKwhPerKg.value,
      waterLitresPerKg: draft.waterLitresPerKg.value,
      hydrogenStorageCapacityKg: draft.hydrogenStorageCapacityKg.value,
      hydrogenSalePriceZarPerKg: draft.hydrogenSalePriceZarPerKg.value,
      operatingCostZarPerHour: draft.operatingCostZarPerHour.value,
      minOperatingTempC: draft.minOperatingTempC.value,
      maxOperatingTempC: draft.maxOperatingTempC.value,
      maintenanceWindowActive: draft.maintenanceWindowActive.value,
      simulationMode: draft.simulationMode,
      configSource: draft.configSource
    },
    update: {
      technology: draft.technology.value,
      minStableLoadKw: draft.minStableLoadKw.value,
      maxLoadKw: draft.maxLoadKw.value,
      rampRateKwPerMin: draft.rampRateKwPerMin.value,
      startUpTimeMin: draft.startUpTimeMin.value,
      shutDownTimeMin: draft.shutDownTimeMin.value,
      minRunTimeMin: draft.minRunTimeMin.value,
      efficiencyKwhPerKg: draft.efficiencyKwhPerKg.value,
      waterLitresPerKg: draft.waterLitresPerKg.value,
      hydrogenStorageCapacityKg: draft.hydrogenStorageCapacityKg.value,
      hydrogenSalePriceZarPerKg: draft.hydrogenSalePriceZarPerKg.value,
      operatingCostZarPerHour: draft.operatingCostZarPerHour.value,
      minOperatingTempC: draft.minOperatingTempC.value,
      maxOperatingTempC: draft.maxOperatingTempC.value,
      maintenanceWindowActive: draft.maintenanceWindowActive.value,
      simulationMode: draft.simulationMode,
      configSource: draft.configSource
    }
  });

  return { configuration: mapElectrolyserConfig(row), violations, advisory: true as const };
};

const defaultHorizon = (): OptimisationHorizonInterval[] => {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  return [0, 1].map((offset) => {
    const intervalStart = new Date(start.getTime() + offset * 60 * 60_000);
    return {
      start: intervalStart.toISOString(),
      durationMinutes: 60,
      generationForecastKw: offset === 0 ? 9000 : 2000,
      exportLimitKw: 5000,
      demandKw: offset === 0 ? 1000 : 2500,
      forecastConfidence: 0.75
    };
  });
};

export const runAdvisoryOptimisation = async (
  input: {
    plantId: string;
    bessAssetId: string;
    electrolyserAssetId: string;
    horizon?: OptimisationHorizonInterval[];
    weights?: Partial<OptimisationWeights>;
    objective?: string;
  },
  actorId?: string,
  actor?: AccessActor
) => {
  const plant = await assertPlantAccess(input.plantId, actor);
  await assertAssetAccess(input.bessAssetId, actor);
  await assertAssetAccess(input.electrolyserAssetId, actor);

  const [bessModel, elyModel] = await Promise.all([
    getBessModel(input.bessAssetId, actor),
    getElectrolyserModel(input.electrolyserAssetId, actor)
  ]);

  const problem: OptimisationProblem = {
    plantId: plant.id,
    bessAssetId: input.bessAssetId,
    electrolyserAssetId: input.electrolyserAssetId,
    bessConfig: bessModel.configuration,
    bessState: bessModel.state,
    electrolyserConfig: elyModel.configuration,
    electrolyserState: elyModel.state,
    horizon: input.horizon?.length ? input.horizon : defaultHorizon(),
    weights: { ...DEFAULT_WEIGHTS, ...input.weights },
    advisoryOnly: true
  };

  const startedAt = new Date();
  const solution = defaultAdvisoryEngine.solve(problem);
  const completedAt = new Date();

  const status =
    solution.status === "completed"
      ? "completed"
      : solution.status === "infeasible"
        ? "infeasible"
        : "failed";

  const createData: Prisma.OptimizationRunCreateInput = {
    organisation: { connect: { id: plant.organisationId } },
    site: { connect: { id: plant.siteId } },
    plant: { connect: { id: plant.id } },
    objective: input.objective ?? "max_net_benefit_advisory",
    status,
    solverVersion: OPTIMISATION_SOLVER_VERSION,
    inputs: problem as unknown as Prisma.InputJsonValue,
    assumptions: solution.assumptions as unknown as Prisma.InputJsonValue,
    result: solution as unknown as Prisma.InputJsonValue,
    constraintViolations: solution.constraintViolations as unknown as Prisma.InputJsonValue,
    warnings: solution.warnings as unknown as Prisma.InputJsonValue,
    baselineComparison: solution.baselineComparison as unknown as Prisma.InputJsonValue,
    expectedBenefitZar: solution.expectedBenefitZar,
    advisory: true,
    startedAt,
    completedAt,
    schedules: {
      create: solution.setpoints.map((sp) => ({
        assetId: sp.assetId,
        intervalStart: new Date(sp.intervalStart),
        intervalEnd: new Date(sp.intervalEnd),
        targetValue: sp.targetKw,
        unit: "kW" as const,
        expectedValue: sp.expectedValue ?? null,
        status: "advisory" as const,
        metadata: sp.note ? { note: sp.note, advisory: true } : { advisory: true }
      }))
    }
  };
  if (actorId) {
    createData.createdBy = { connect: { id: actorId } };
  }

  const run = await prisma.optimizationRun.create({
    data: createData,
    include: { schedules: true }
  });

  return {
    ...run,
    advisory: true as const,
    advisoryLabel: "Advisory only ΓÇö no physical dispatch",
    physicalControl: false as const,
    solverVersion: OPTIMISATION_SOLVER_VERSION
  };
};

export const listOptimisationRuns = async (
  filters: { plantId?: string; siteId?: string; limit?: number },
  actor?: AccessActor
) => {
  const scope = await getOptionalSiteAccessScope(actor);
  const where: Prisma.OptimizationRunWhereInput = { advisory: true };

  if (scope.kind === "site") {
    where.siteId = scope.siteId;
  } else if (filters.siteId) {
    where.siteId = filters.siteId;
  }
  if (filters.plantId) where.plantId = filters.plantId;

  const runs = await prisma.optimizationRun.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    take: Math.min(filters.limit ?? 50, 200),
    include: {
      plant: { select: { id: true, name: true, code: true } },
      _count: { select: { schedules: true } }
    }
  });

  return runs.map((run) => ({
    ...run,
    advisory: true as const,
    advisoryLabel: "Advisory only ΓÇö no physical dispatch"
  }));
};

export const getOptimisationRun = async (runId: string, actor?: AccessActor) => {
  const scope = await getOptionalSiteAccessScope(actor);
  const run = await prisma.optimizationRun.findUnique({
    where: { id: runId },
    include: {
      schedules: { orderBy: [{ intervalStart: "asc" }] },
      plant: { select: { id: true, name: true, code: true } },
      site: { select: { id: true, name: true, code: true } }
    }
  });
  if (!run) throw new AppError("Optimisation run not found.", 404);
  if (scope.kind === "site" && run.siteId !== scope.siteId) {
    throw new AppError("Cross-tenant optimisation access denied.", 403);
  }
  return {
    ...run,
    advisory: true as const,
    advisoryLabel: "Advisory only ΓÇö no physical dispatch",
    physicalControl: false as const
  };
};
