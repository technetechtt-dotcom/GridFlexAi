-- Foundation production hardening: provenance, tenancy, plant/asset, telemetry v2, device credentials, node health.

-- Enums
DO $$ BEGIN CREATE TYPE "MembershipRole" AS ENUM ('portfolio_admin', 'plant_manager', 'operator', 'engineer', 'analyst', 'viewer', 'developer', 'super_admin'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "MembershipStatus" AS ENUM ('active', 'invited', 'suspended'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "OrganisationStatus" AS ENUM ('active', 'suspended', 'archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "NodeHealthState" AS ENUM ('online', 'stale', 'degraded', 'offline', 'maintenance', 'disabled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "DataSourceType" AS ENUM ('measured', 'calculated', 'forecast', 'estimated', 'simulated', 'operator_entered', 'imported'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "DataQuality" AS ENUM ('valid', 'uncertain', 'stale', 'missing', 'invalid', 'substituted', 'unverified'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "MeasurementUnit" AS ENUM ('V', 'A', 'Hz', 'kW', 'MW', 'kWh', 'MWh', 'kVAr', 'MVAr', 'kVA', 'MVA', 'percent', 'celsius', 'wm2', 'kg', 'kg_per_hour', 'litre', 'litre_per_hour', 'zar', 'zar_per_kwh', 'zar_per_mwh', 'zar_per_kg'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "AssetType" AS ENUM ('grid_connection', 'revenue_meter', 'plant_power_controller', 'inverter', 'solar_array', 'weather_station', 'transformer', 'feeder', 'switchgear', 'protection_relay', 'bess', 'battery_management_system', 'battery_rack', 'power_conversion_system', 'electrolyser', 'hydrogen_storage', 'compressor', 'flexible_load', 'edge_gateway', 'sensor', 'virtual_asset'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "AssetStatus" AS ENUM ('planned', 'commissioning', 'operational', 'maintenance', 'decommissioned', 'simulated'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "DeviceCredentialStatus" AS ENUM ('pending', 'active', 'rotating', 'revoked', 'expired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "PlantStatus" AS ENUM ('planned', 'operational', 'maintenance', 'decommissioned', 'simulated'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "Organisation" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL UNIQUE,
  "status" "OrganisationStatus" NOT NULL DEFAULT 'active',
  "timezone" TEXT NOT NULL DEFAULT 'Africa/Johannesburg',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "OrganisationMembership" (
  "id" TEXT PRIMARY KEY,
  "organisationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "MembershipRole" NOT NULL,
  "status" "MembershipStatus" NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrganisationMembership_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OrganisationMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "OrganisationMembership_organisationId_userId_key" ON "OrganisationMembership"("organisationId", "userId");
CREATE INDEX IF NOT EXISTS "OrganisationMembership_userId_idx" ON "OrganisationMembership"("userId");

CREATE TABLE IF NOT EXISTS "SiteMembership" (
  "id" TEXT PRIMARY KEY,
  "siteId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "MembershipRole" NOT NULL,
  "status" "MembershipStatus" NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SiteMembership_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SiteMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "SiteMembership_siteId_userId_key" ON "SiteMembership"("siteId", "userId");
CREATE INDEX IF NOT EXISTS "SiteMembership_userId_idx" ON "SiteMembership"("userId");

ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "organisationId" TEXT;
ALTER TABLE "Site" ADD COLUMN IF NOT EXISTS "organisationId" TEXT;

DO $$ BEGIN
  ALTER TABLE "Client" ADD CONSTRAINT "Client_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Site" ADD CONSTRAINT "Site_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "Plant" (
  "id" TEXT PRIMARY KEY,
  "organisationId" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "technology" TEXT NOT NULL DEFAULT 'solar_pv',
  "installedCapacityKw" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "exportCapacityKw" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "timezone" TEXT NOT NULL DEFAULT 'Africa/Johannesburg',
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "status" "PlantStatus" NOT NULL DEFAULT 'simulated',
  "dataSourceType" "DataSourceType" NOT NULL DEFAULT 'simulated',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Plant_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Plant_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Plant_organisationId_code_key" ON "Plant"("organisationId", "code");
CREATE INDEX IF NOT EXISTS "Plant_siteId_idx" ON "Plant"("siteId");

CREATE TABLE IF NOT EXISTS "Asset" (
  "id" TEXT PRIMARY KEY,
  "plantId" TEXT NOT NULL,
  "parentAssetId" TEXT,
  "type" "AssetType" NOT NULL,
  "name" TEXT NOT NULL,
  "manufacturer" TEXT,
  "model" TEXT,
  "serialNumber" TEXT,
  "protocol" TEXT,
  "externalReference" TEXT,
  "ratedPowerKw" DOUBLE PRECISION,
  "ratedEnergyKwh" DOUBLE PRECISION,
  "status" "AssetStatus" NOT NULL DEFAULT 'simulated',
  "dataSourceType" "DataSourceType" NOT NULL DEFAULT 'simulated',
  "commissionedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Asset_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Asset_parentAssetId_fkey" FOREIGN KEY ("parentAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Asset_plantId_type_idx" ON "Asset"("plantId", "type");

CREATE TABLE IF NOT EXISTS "AssetConstraint" (
  "id" TEXT PRIMARY KEY,
  "assetId" TEXT NOT NULL,
  "constraintType" TEXT NOT NULL,
  "minimumValue" DOUBLE PRECISION,
  "maximumValue" DOUBLE PRECISION,
  "unit" "MeasurementUnit" NOT NULL,
  "validFrom" TIMESTAMP(3),
  "validTo" TIMESTAMP(3),
  "source" "DataSourceType" NOT NULL DEFAULT 'operator_entered',
  "approvedBy" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssetConstraint_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "AssetState" (
  "assetId" TEXT PRIMARY KEY,
  "operatingState" TEXT NOT NULL DEFAULT 'unknown',
  "available" BOOLEAN NOT NULL DEFAULT true,
  "lastCommunicationAt" TIMESTAMP(3),
  "alarmState" TEXT,
  "metadata" JSONB,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssetState_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

ALTER TABLE "EdgeNode" ADD COLUMN IF NOT EXISTS "assetId" TEXT;
ALTER TABLE "EdgeNode" ADD COLUMN IF NOT EXISTS "healthState" "NodeHealthState" NOT NULL DEFAULT 'offline';
ALTER TABLE "EdgeNode" ADD COLUMN IF NOT EXISTS "enclosureTemperatureC" DOUBLE PRECISION;
ALTER TABLE "EdgeNode" ADD COLUMN IF NOT EXISTS "storageUtilisationPct" DOUBLE PRECISION;
ALTER TABLE "EdgeNode" ADD COLUMN IF NOT EXISTS "queueDepth" INTEGER;
ALTER TABLE "EdgeNode" ADD COLUMN IF NOT EXISTS "restartCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "EdgeNode" ADD COLUMN IF NOT EXISTS "watchdogResetCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "EdgeNode" ADD COLUMN IF NOT EXISTS "heartbeatIntervalSec" INTEGER NOT NULL DEFAULT 60;
ALTER TABLE "EdgeNode" ADD COLUMN IF NOT EXISTS "staleAfterSec" INTEGER NOT NULL DEFAULT 120;
ALTER TABLE "EdgeNode" ADD COLUMN IF NOT EXISTS "offlineAfterSec" INTEGER NOT NULL DEFAULT 600;
ALTER TABLE "EdgeNode" ADD COLUMN IF NOT EXISTS "lastSuccessfulIngestAt" TIMESTAMP(3);
ALTER TABLE "EdgeNode" ADD COLUMN IF NOT EXISTS "lastInvalidPayloadAt" TIMESTAMP(3);
ALTER TABLE "EdgeNode" ADD COLUMN IF NOT EXISTS "lastAuthFailureAt" TIMESTAMP(3);

DO $$ BEGIN
  ALTER TABLE "EdgeNode" ADD CONSTRAINT "EdgeNode_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "EdgeNode_assetId_key" ON "EdgeNode"("assetId");

CREATE TABLE IF NOT EXISTS "NodeHealthHistory" (
  "id" TEXT PRIMARY KEY,
  "nodeId" TEXT NOT NULL,
  "fromState" "NodeHealthState",
  "toState" "NodeHealthState" NOT NULL,
  "reason" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NodeHealthHistory_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "EdgeNode"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "NodeHealthHistory_nodeId_createdAt_idx" ON "NodeHealthHistory"("nodeId", "createdAt");

ALTER TABLE "SensorReading" ADD COLUMN IF NOT EXISTS "deviceTimestamp" TIMESTAMP(3);
ALTER TABLE "SensorReading" ADD COLUMN IF NOT EXISTS "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "SensorReading" ADD COLUMN IF NOT EXISTS "sequenceNumber" INTEGER;
ALTER TABLE "SensorReading" ADD COLUMN IF NOT EXISTS "schemaVersion" TEXT DEFAULT '1';
ALTER TABLE "SensorReading" ADD COLUMN IF NOT EXISTS "firmwareVersion" TEXT;
ALTER TABLE "SensorReading" ADD COLUMN IF NOT EXISTS "calibrationVersion" TEXT;
ALTER TABLE "SensorReading" ADD COLUMN IF NOT EXISTS "qualityFlags" JSONB;
ALTER TABLE "SensorReading" ADD COLUMN IF NOT EXISTS "sourceAssetId" TEXT;
ALTER TABLE "SensorReading" ADD COLUMN IF NOT EXISTS "sourceType" "DataSourceType" NOT NULL DEFAULT 'measured';
ALTER TABLE "SensorReading" ADD COLUMN IF NOT EXISTS "quality" "DataQuality" NOT NULL DEFAULT 'valid';
ALTER TABLE "SensorReading" ADD COLUMN IF NOT EXISTS "powerUnit" "MeasurementUnit" NOT NULL DEFAULT 'kW';
ALTER TABLE "SensorReading" ADD COLUMN IF NOT EXISTS "voltageUnit" "MeasurementUnit" NOT NULL DEFAULT 'V';
ALTER TABLE "SensorReading" ADD COLUMN IF NOT EXISTS "currentUnit" "MeasurementUnit" NOT NULL DEFAULT 'A';

CREATE TABLE IF NOT EXISTS "TelemetryPointDefinition" (
  "id" TEXT PRIMARY KEY,
  "assetId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "unit" "MeasurementUnit" NOT NULL,
  "dataType" TEXT NOT NULL DEFAULT 'number',
  "sourceType" "DataSourceType" NOT NULL DEFAULT 'measured',
  "minimumValidValue" DOUBLE PRECISION,
  "maximumValidValue" DOUBLE PRECISION,
  "writable" BOOLEAN NOT NULL DEFAULT false,
  "critical" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TelemetryPointDefinition_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "TelemetryPointDefinition_assetId_key_key" ON "TelemetryPointDefinition"("assetId", "key");

CREATE TABLE IF NOT EXISTS "TelemetryReading" (
  "id" TEXT PRIMARY KEY,
  "organisationId" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "plantId" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "pointDefinitionId" TEXT,
  "key" TEXT NOT NULL,
  "numericValue" DOUBLE PRECISION,
  "stringValue" TEXT,
  "booleanValue" BOOLEAN,
  "unit" "MeasurementUnit" NOT NULL,
  "quality" "DataQuality" NOT NULL DEFAULT 'valid',
  "sourceType" "DataSourceType" NOT NULL DEFAULT 'measured',
  "deviceTimestamp" TIMESTAMP(3) NOT NULL,
  "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sequenceNumber" INTEGER,
  "schemaVersion" TEXT NOT NULL DEFAULT '2',
  "firmwareVersion" TEXT,
  "calibrationVersion" TEXT,
  "qualityFlags" JSONB,
  "rawPayloadReference" TEXT,
  CONSTRAINT "TelemetryReading_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TelemetryReading_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TelemetryReading_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TelemetryReading_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TelemetryReading_pointDefinitionId_fkey" FOREIGN KEY ("pointDefinitionId") REFERENCES "TelemetryPointDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "TelemetryReading_assetId_key_deviceTimestamp_sequenceNumber_key" ON "TelemetryReading"("assetId", "key", "deviceTimestamp", "sequenceNumber");
CREATE INDEX IF NOT EXISTS "TelemetryReading_organisationId_deviceTimestamp_idx" ON "TelemetryReading"("organisationId", "deviceTimestamp");

CREATE TABLE IF NOT EXISTS "DeviceCredential" (
  "id" TEXT PRIMARY KEY,
  "edgeNodeId" TEXT NOT NULL,
  "credentialId" TEXT NOT NULL UNIQUE,
  "secretHash" TEXT NOT NULL,
  "keyVersion" INTEGER NOT NULL DEFAULT 1,
  "status" "DeviceCredentialStatus" NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "lastUsedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "rotatedAt" TIMESTAMP(3),
  CONSTRAINT "DeviceCredential_edgeNodeId_fkey" FOREIGN KEY ("edgeNodeId") REFERENCES "EdgeNode"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "DeviceCredential_edgeNodeId_status_idx" ON "DeviceCredential"("edgeNodeId", "status");

CREATE TABLE IF NOT EXISTS "DeviceProvisioningEvent" (
  "id" TEXT PRIMARY KEY,
  "edgeNodeId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "actorId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeviceProvisioningEvent_edgeNodeId_fkey" FOREIGN KEY ("edgeNodeId") REFERENCES "EdgeNode"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "organisationId" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "siteId" TEXT;
DO $$ BEGIN
  ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Backfill organisations from existing clients (preserve Client rows).
INSERT INTO "Organisation" ("id", "name", "slug", "status", "timezone", "createdAt", "updatedAt")
SELECT 'org_' || c."id", c."name", c."slug", 'active', 'Africa/Johannesburg', c."createdAt", c."updatedAt"
FROM "Client" c
WHERE NOT EXISTS (SELECT 1 FROM "Organisation" o WHERE o."slug" = c."slug");

UPDATE "Client" c
SET "organisationId" = o."id"
FROM "Organisation" o
WHERE o."slug" = c."slug" AND c."organisationId" IS NULL;

UPDATE "Site" s
SET "organisationId" = c."organisationId"
FROM "Client" c
WHERE s."clientId" = c."id" AND s."organisationId" IS NULL AND c."organisationId" IS NOT NULL;
