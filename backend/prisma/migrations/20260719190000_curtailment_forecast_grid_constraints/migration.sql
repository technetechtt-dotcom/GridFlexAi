-- PR2: curtailment events, forecast scoring vintages, and explicit grid constraints.

DO $$ BEGIN CREATE TYPE "CurtailmentCause" AS ENUM (
  'grid_instruction',
  'network_congestion',
  'export_limit',
  'ppc_limit',
  'negative_price',
  'economic_dispatch',
  'inverter_clipping',
  'inverter_derating',
  'equipment_fault',
  'maintenance',
  'weather',
  'unknown'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE "CurtailmentEventStatus" AS ENUM (
  'open',
  'closed',
  'under_review',
  'confirmed',
  'dismissed'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE "GridConstraintType" AS ENUM (
  'feeder',
  'transformer',
  'line',
  'export',
  'outage',
  'operator',
  'contingency'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "CurtailmentEvent" (
  "id" TEXT PRIMARY KEY,
  "organisationId" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "plantId" TEXT NOT NULL,
  "startTime" TIMESTAMP(3) NOT NULL,
  "endTime" TIMESTAMP(3),
  "status" "CurtailmentEventStatus" NOT NULL DEFAULT 'open',
  "cause" "CurtailmentCause" NOT NULL DEFAULT 'unknown',
  "causeConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "availablePowerKw" DOUBLE PRECISION NOT NULL,
  "actualPowerKw" DOUBLE PRECISION NOT NULL,
  "curtailedPowerKw" DOUBLE PRECISION NOT NULL,
  "estimatedLostEnergyKwh" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "recoverableEnergyKwh" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "exportLimitKw" DOUBLE PRECISION,
  "ppcSetpointKw" DOUBLE PRECISION,
  "evidence" JSONB,
  "calculationVersion" TEXT NOT NULL,
  "reviewedBy" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "operatorNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CurtailmentEvent_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CurtailmentEvent_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CurtailmentEvent_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "CurtailmentEvent_organisationId_startTime_idx" ON "CurtailmentEvent"("organisationId", "startTime");
CREATE INDEX IF NOT EXISTS "CurtailmentEvent_siteId_startTime_idx" ON "CurtailmentEvent"("siteId", "startTime");
CREATE INDEX IF NOT EXISTS "CurtailmentEvent_plantId_startTime_idx" ON "CurtailmentEvent"("plantId", "startTime");
CREATE INDEX IF NOT EXISTS "CurtailmentEvent_status_cause_idx" ON "CurtailmentEvent"("status", "cause");
CREATE INDEX IF NOT EXISTS "CurtailmentEvent_calculationVersion_idx" ON "CurtailmentEvent"("calculationVersion");

CREATE TABLE IF NOT EXISTS "CurtailmentCorrection" (
  "id" TEXT PRIMARY KEY,
  "eventId" TEXT NOT NULL,
  "correctedCause" "CurtailmentCause",
  "correctedRecoverableEnergyKwh" DOUBLE PRECISION,
  "notes" TEXT NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CurtailmentCorrection_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CurtailmentEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CurtailmentCorrection_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "CurtailmentCorrection_eventId_createdAt_idx" ON "CurtailmentCorrection"("eventId", "createdAt");
CREATE INDEX IF NOT EXISTS "CurtailmentCorrection_createdById_idx" ON "CurtailmentCorrection"("createdById");

CREATE TABLE IF NOT EXISTS "PlantForecastConfig" (
  "id" TEXT PRIMARY KEY,
  "plantId" TEXT NOT NULL UNIQUE,
  "dcCapacityKw" DOUBLE PRECISION NOT NULL,
  "acCapacityKw" DOUBLE PRECISION NOT NULL,
  "tiltDeg" DOUBLE PRECISION NOT NULL DEFAULT 20,
  "azimuthDeg" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlantForecastConfig_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ForecastRun" (
  "id" TEXT PRIMARY KEY,
  "organisationId" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "plantId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "sourceType" "DataSourceType" NOT NULL DEFAULT 'forecast',
  "quality" "DataQuality" NOT NULL DEFAULT 'unverified',
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "validFrom" TIMESTAMP(3) NOT NULL,
  "validTo" TIMESTAMP(3) NOT NULL,
  "freshnessSeconds" INTEGER,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ForecastRun_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ForecastRun_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ForecastRun_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ForecastRun_organisationId_generatedAt_idx" ON "ForecastRun"("organisationId", "generatedAt");
CREATE INDEX IF NOT EXISTS "ForecastRun_siteId_generatedAt_idx" ON "ForecastRun"("siteId", "generatedAt");
CREATE INDEX IF NOT EXISTS "ForecastRun_plantId_generatedAt_idx" ON "ForecastRun"("plantId", "generatedAt");
CREATE INDEX IF NOT EXISTS "ForecastRun_provider_version_idx" ON "ForecastRun"("provider", "version");
CREATE INDEX IF NOT EXISTS "ForecastRun_sourceType_quality_idx" ON "ForecastRun"("sourceType", "quality");

CREATE TABLE IF NOT EXISTS "ForecastValue" (
  "id" TEXT PRIMARY KEY,
  "forecastRunId" TEXT NOT NULL,
  "targetTime" TIMESTAMP(3) NOT NULL,
  "horizonMinutes" INTEGER NOT NULL,
  "p10Kw" DOUBLE PRECISION,
  "p50Kw" DOUBLE PRECISION NOT NULL,
  "p90Kw" DOUBLE PRECISION,
  "unit" "MeasurementUnit" NOT NULL DEFAULT 'kW',
  "sourceType" "DataSourceType" NOT NULL DEFAULT 'forecast',
  "quality" "DataQuality" NOT NULL DEFAULT 'unverified',
  CONSTRAINT "ForecastValue_forecastRunId_fkey" FOREIGN KEY ("forecastRunId") REFERENCES "ForecastRun"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ForecastValue_forecastRunId_targetTime_idx" ON "ForecastValue"("forecastRunId", "targetTime");
CREATE INDEX IF NOT EXISTS "ForecastValue_targetTime_horizonMinutes_idx" ON "ForecastValue"("targetTime", "horizonMinutes");

CREATE TABLE IF NOT EXISTS "ForecastAccuracyScore" (
  "id" TEXT PRIMARY KEY,
  "plantId" TEXT NOT NULL,
  "horizonMinutes" INTEGER NOT NULL,
  "provider" TEXT,
  "maeKw" DOUBLE PRECISION NOT NULL,
  "rmseKw" DOUBLE PRECISION NOT NULL,
  "mapePercent" DOUBLE PRECISION,
  "biasKw" DOUBLE PRECISION NOT NULL,
  "sampleCount" INTEGER NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "scoredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "calculationVersion" TEXT NOT NULL DEFAULT 'forecast-score-v1',
  "metadata" JSONB,
  CONSTRAINT "ForecastAccuracyScore_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ForecastAccuracyScore_plantId_horizonMinutes_scoredAt_idx" ON "ForecastAccuracyScore"("plantId", "horizonMinutes", "scoredAt");
CREATE INDEX IF NOT EXISTS "ForecastAccuracyScore_provider_scoredAt_idx" ON "ForecastAccuracyScore"("provider", "scoredAt");

CREATE TABLE IF NOT EXISTS "GridConstraint" (
  "id" TEXT PRIMARY KEY,
  "organisationId" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "plantId" TEXT,
  "constraintType" "GridConstraintType" NOT NULL,
  "name" TEXT NOT NULL,
  "limitValue" DOUBLE PRECISION NOT NULL,
  "unit" "MeasurementUnit" NOT NULL,
  "validFrom" TIMESTAMP(3),
  "validTo" TIMESTAMP(3),
  "sourceType" "DataSourceType" NOT NULL DEFAULT 'operator_entered',
  "quality" "DataQuality" NOT NULL DEFAULT 'unverified',
  "provenance" JSONB,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GridConstraint_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "GridConstraint_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "GridConstraint_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "GridConstraint_organisationId_constraintType_idx" ON "GridConstraint"("organisationId", "constraintType");
CREATE INDEX IF NOT EXISTS "GridConstraint_siteId_constraintType_idx" ON "GridConstraint"("siteId", "constraintType");
CREATE INDEX IF NOT EXISTS "GridConstraint_plantId_constraintType_idx" ON "GridConstraint"("plantId", "constraintType");
CREATE INDEX IF NOT EXISTS "GridConstraint_validFrom_validTo_idx" ON "GridConstraint"("validFrom", "validTo");
CREATE INDEX IF NOT EXISTS "GridConstraint_sourceType_idx" ON "GridConstraint"("sourceType");
