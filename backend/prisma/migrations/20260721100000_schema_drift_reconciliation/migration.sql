-- Reconcile schema additions and indexes that were present in the Prisma
-- datamodel but missing from the migration history.

CREATE TABLE "BillingAccount" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'starter',
    "status" TEXT NOT NULL DEFAULT 'active',
    "billingEmail" TEXT,
    "taxId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BillingAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "billingAccountId" TEXT NOT NULL,
    "amountDue" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "dueDate" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "invoicePdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BillingAccount_clientId_key" ON "BillingAccount"("clientId");
ALTER TABLE "BillingAccount"
ADD CONSTRAINT "BillingAccount_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invoice"
ADD CONSTRAINT "Invoice_billingAccountId_fkey"
FOREIGN KEY ("billingAccountId") REFERENCES "BillingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AlarmRule" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "Asset" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "AssetState" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "CommandExecution" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "CommandRequest" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "CurtailmentEvent" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "EdgeNode" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "GridConstraint" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "Organisation" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "Plant" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "PlantForecastConfig" ALTER COLUMN "updatedAt" DROP DEFAULT;

CREATE INDEX "Asset_parentAssetId_idx" ON "Asset"("parentAssetId");
CREATE INDEX "Asset_serialNumber_idx" ON "Asset"("serialNumber");
CREATE INDEX "AssetConstraint_assetId_constraintType_idx" ON "AssetConstraint"("assetId", "constraintType");
CREATE INDEX "AuditLog_organisationId_createdAt_idx" ON "AuditLog"("organisationId", "createdAt");
CREATE INDEX "AuditLog_siteId_createdAt_idx" ON "AuditLog"("siteId", "createdAt");
CREATE INDEX "Client_organisationId_idx" ON "Client"("organisationId");
CREATE INDEX "DeviceCredential_keyVersion_idx" ON "DeviceCredential"("keyVersion");
CREATE INDEX "DeviceProvisioningEvent_edgeNodeId_createdAt_idx" ON "DeviceProvisioningEvent"("edgeNodeId", "createdAt");
CREATE INDEX "EdgeNode_healthState_idx" ON "EdgeNode"("healthState");
CREATE INDEX "Organisation_status_idx" ON "Organisation"("status");
CREATE INDEX "OrganisationMembership_organisationId_role_idx" ON "OrganisationMembership"("organisationId", "role");
CREATE INDEX "Plant_organisationId_status_idx" ON "Plant"("organisationId", "status");
CREATE INDEX "SensorReading_nodeId_ingestedAt_idx" ON "SensorReading"("nodeId", "ingestedAt" DESC);
CREATE INDEX "SensorReading_sourceType_idx" ON "SensorReading"("sourceType");
CREATE INDEX "SensorReading_quality_idx" ON "SensorReading"("quality");
CREATE INDEX "Site_organisationId_idx" ON "Site"("organisationId");
CREATE INDEX "SiteMembership_siteId_role_idx" ON "SiteMembership"("siteId", "role");
CREATE INDEX "TelemetryPointDefinition_key_idx" ON "TelemetryPointDefinition"("key");
CREATE INDEX "TelemetryReading_siteId_deviceTimestamp_idx" ON "TelemetryReading"("siteId", "deviceTimestamp");
CREATE INDEX "TelemetryReading_plantId_deviceTimestamp_idx" ON "TelemetryReading"("plantId", "deviceTimestamp");
CREATE INDEX "TelemetryReading_assetId_key_deviceTimestamp_idx" ON "TelemetryReading"("assetId", "key", "deviceTimestamp");
CREATE INDEX "TelemetryReading_ingestedAt_idx" ON "TelemetryReading"("ingestedAt");
