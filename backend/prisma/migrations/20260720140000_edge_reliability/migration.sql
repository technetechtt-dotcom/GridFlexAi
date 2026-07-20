-- Phase 5: idempotent edge ingest receipts + signed remote configuration.

CREATE TABLE IF NOT EXISTS "EdgeIngestReceipt" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "messageId" TEXT,
    "readingId" TEXT,
    "payloadHash" TEXT,
    "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EdgeIngestReceipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EdgeIngestReceipt_deviceId_sequenceNumber_key"
  ON "EdgeIngestReceipt"("deviceId", "sequenceNumber");

CREATE INDEX IF NOT EXISTS "EdgeIngestReceipt_deviceId_acknowledgedAt_idx"
  ON "EdgeIngestReceipt"("deviceId", "acknowledgedAt");

-- Optional uniqueness on sensor readings when sequence is present (NULLs remain distinct in Postgres).
CREATE UNIQUE INDEX IF NOT EXISTS "SensorReading_nodeId_sequenceNumber_key"
  ON "SensorReading"("nodeId", "sequenceNumber");

CREATE TABLE IF NOT EXISTS "EdgeRemoteConfig" (
    "id" TEXT NOT NULL,
    "configVersion" TEXT NOT NULL,
    "pollingIntervalMs" INTEGER NOT NULL,
    "serverEndpoint" TEXT NOT NULL,
    "enabledTelemetryKeys" JSONB NOT NULL,
    "approvedFirmwareMinimum" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    CONSTRAINT "EdgeRemoteConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EdgeRemoteConfig_configVersion_key"
  ON "EdgeRemoteConfig"("configVersion");

CREATE INDEX IF NOT EXISTS "EdgeRemoteConfig_isActive_issuedAt_idx"
  ON "EdgeRemoteConfig"("isActive", "issuedAt");
