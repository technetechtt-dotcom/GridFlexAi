-- PR3: provenance-aware BESS/electrolyser models + advisory optimisation persistence
-- Additive only. Does not invent vendor registers or enable physical control.

CREATE TYPE "OptimizationRunStatus" AS ENUM ('pending', 'running', 'completed', 'infeasible', 'failed');
CREATE TYPE "DispatchScheduleStatus" AS ENUM ('advisory', 'expired', 'superseded', 'rejected');

CREATE TABLE "BessModelConfig" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "ratedPowerKw" DOUBLE PRECISION NOT NULL,
    "ratedEnergyKwh" DOUBLE PRECISION NOT NULL,
    "minSocPercent" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "maxSocPercent" DOUBLE PRECISION NOT NULL DEFAULT 90,
    "chargeEfficiency" DOUBLE PRECISION NOT NULL DEFAULT 0.95,
    "dischargeEfficiency" DOUBLE PRECISION NOT NULL DEFAULT 0.95,
    "maxChargePowerKw" DOUBLE PRECISION NOT NULL,
    "maxDischargePowerKw" DOUBLE PRECISION NOT NULL,
    "rampLimitKwPerMin" DOUBLE PRECISION NOT NULL DEFAULT 500,
    "degradationCostZarPerMwh" DOUBLE PRECISION NOT NULL DEFAULT 120,
    "reserveSocPercent" DOUBLE PRECISION NOT NULL DEFAULT 15,
    "minOperatingTempC" DOUBLE PRECISION,
    "maxOperatingTempC" DOUBLE PRECISION,
    "warrantyCycleLimit" INTEGER,
    "simulationMode" BOOLEAN NOT NULL DEFAULT true,
    "configSource" "DataSourceType" NOT NULL DEFAULT 'operator_entered',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BessModelConfig_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BessModelConfig_assetId_key" ON "BessModelConfig"("assetId");

CREATE TABLE "BessOperatingState" (
    "assetId" TEXT NOT NULL,
    "socPercent" DOUBLE PRECISION NOT NULL,
    "socSource" "DataSourceType" NOT NULL DEFAULT 'simulated',
    "socQuality" "DataQuality" NOT NULL DEFAULT 'unverified',
    "temperatureC" DOUBLE PRECISION,
    "chargePowerKw" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dischargePowerKw" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "availableChargePowerKw" DOUBLE PRECISION,
    "availableDischargePowerKw" DOUBLE PRECISION,
    "cycleCount" INTEGER,
    "alarmState" TEXT,
    "operatingState" TEXT NOT NULL DEFAULT 'unknown',
    "simulationMode" BOOLEAN NOT NULL DEFAULT true,
    "asOf" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BessOperatingState_pkey" PRIMARY KEY ("assetId")
);

CREATE TABLE "ElectrolyserModelConfig" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "technology" TEXT NOT NULL DEFAULT 'alkaline',
    "minStableLoadKw" DOUBLE PRECISION NOT NULL,
    "maxLoadKw" DOUBLE PRECISION NOT NULL,
    "rampRateKwPerMin" DOUBLE PRECISION NOT NULL DEFAULT 250,
    "startUpTimeMin" DOUBLE PRECISION NOT NULL DEFAULT 15,
    "shutDownTimeMin" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "minRunTimeMin" DOUBLE PRECISION NOT NULL DEFAULT 30,
    "efficiencyKwhPerKg" DOUBLE PRECISION NOT NULL DEFAULT 52,
    "waterLitresPerKg" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "hydrogenStorageCapacityKg" DOUBLE PRECISION NOT NULL,
    "hydrogenSalePriceZarPerKg" DOUBLE PRECISION NOT NULL DEFAULT 85,
    "operatingCostZarPerHour" DOUBLE PRECISION NOT NULL DEFAULT 400,
    "minOperatingTempC" DOUBLE PRECISION,
    "maxOperatingTempC" DOUBLE PRECISION,
    "maintenanceWindowActive" BOOLEAN NOT NULL DEFAULT false,
    "simulationMode" BOOLEAN NOT NULL DEFAULT true,
    "configSource" "DataSourceType" NOT NULL DEFAULT 'operator_entered',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ElectrolyserModelConfig_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ElectrolyserModelConfig_assetId_key" ON "ElectrolyserModelConfig"("assetId");

CREATE TABLE "ElectrolyserOperatingState" (
    "assetId" TEXT NOT NULL,
    "loadPowerKw" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "loadSource" "DataSourceType" NOT NULL DEFAULT 'simulated',
    "loadQuality" "DataQuality" NOT NULL DEFAULT 'unverified',
    "productionKgPerHour" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "storageLevelKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "waterFlowLitrePerHour" DOUBLE PRECISION,
    "stackTemperatureC" DOUBLE PRECISION,
    "operatingMode" TEXT NOT NULL DEFAULT 'standby',
    "alarmState" TEXT,
    "runTimeMinutes" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "simulationMode" BOOLEAN NOT NULL DEFAULT true,
    "asOf" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ElectrolyserOperatingState_pkey" PRIMARY KEY ("assetId")
);

CREATE TABLE "OptimizationRun" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "status" "OptimizationRunStatus" NOT NULL DEFAULT 'pending',
    "solverVersion" TEXT NOT NULL,
    "forecastVersion" TEXT,
    "inputs" JSONB NOT NULL,
    "assumptions" JSONB,
    "result" JSONB,
    "constraintViolations" JSONB,
    "warnings" JSONB,
    "baselineComparison" JSONB,
    "expectedBenefitZar" DOUBLE PRECISION,
    "advisory" BOOLEAN NOT NULL DEFAULT true,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OptimizationRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OptimizationRun_organisationId_createdAt_idx" ON "OptimizationRun"("organisationId", "createdAt");
CREATE INDEX "OptimizationRun_siteId_createdAt_idx" ON "OptimizationRun"("siteId", "createdAt");
CREATE INDEX "OptimizationRun_plantId_createdAt_idx" ON "OptimizationRun"("plantId", "createdAt");
CREATE INDEX "OptimizationRun_status_idx" ON "OptimizationRun"("status");
CREATE INDEX "OptimizationRun_createdById_idx" ON "OptimizationRun"("createdById");

CREATE TABLE "DispatchSchedule" (
    "id" TEXT NOT NULL,
    "optimizationRunId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "intervalStart" TIMESTAMP(3) NOT NULL,
    "intervalEnd" TIMESTAMP(3) NOT NULL,
    "targetValue" DOUBLE PRECISION NOT NULL,
    "unit" "MeasurementUnit" NOT NULL DEFAULT 'kW',
    "expectedValue" DOUBLE PRECISION,
    "status" "DispatchScheduleStatus" NOT NULL DEFAULT 'advisory',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DispatchSchedule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DispatchSchedule_optimizationRunId_intervalStart_idx" ON "DispatchSchedule"("optimizationRunId", "intervalStart");
CREATE INDEX "DispatchSchedule_assetId_intervalStart_idx" ON "DispatchSchedule"("assetId", "intervalStart");
CREATE INDEX "DispatchSchedule_status_idx" ON "DispatchSchedule"("status");

ALTER TABLE "BessModelConfig" ADD CONSTRAINT "BessModelConfig_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BessOperatingState" ADD CONSTRAINT "BessOperatingState_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ElectrolyserModelConfig" ADD CONSTRAINT "ElectrolyserModelConfig_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ElectrolyserOperatingState" ADD CONSTRAINT "ElectrolyserOperatingState_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OptimizationRun" ADD CONSTRAINT "OptimizationRun_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OptimizationRun" ADD CONSTRAINT "OptimizationRun_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OptimizationRun" ADD CONSTRAINT "OptimizationRun_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OptimizationRun" ADD CONSTRAINT "OptimizationRun_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DispatchSchedule" ADD CONSTRAINT "DispatchSchedule_optimizationRunId_fkey" FOREIGN KEY ("optimizationRunId") REFERENCES "OptimizationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DispatchSchedule" ADD CONSTRAINT "DispatchSchedule_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
