-- PR4: Command request / approval / execution architecture (advisory + simulated executor).

DO $$ BEGIN CREATE TYPE "CommandRequestStatus" AS ENUM (
  'proposed', 'pending_approval', 'approved', 'rejected', 'expired',
  'queued', 'sent', 'acknowledged', 'verified', 'failed', 'rolled_back', 'cancelled'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE "CommandSource" AS ENUM ('operator', 'zolt_ai', 'optimisation', 'system');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE "CommandRiskLevel" AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE "CommandApprovalDecision" AS ENUM ('approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE "CommandExecutionStatus" AS ENUM (
  'queued', 'sent', 'acknowledged', 'verified', 'failed', 'rolled_back', 'cancelled'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE "CommandOverrideState" AS ENUM (
  'none', 'manual_override', 'emergency_stop', 'safe_state'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "CommandRequest" (
  "id" TEXT PRIMARY KEY,
  "organisationId" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "plantId" TEXT NOT NULL,
  "targetAssetId" TEXT NOT NULL,
  "commandType" TEXT NOT NULL,
  "requestedValue" DOUBLE PRECISION NOT NULL,
  "unit" "MeasurementUnit" NOT NULL,
  "currentValue" DOUBLE PRECISION,
  "minimumAllowed" DOUBLE PRECISION,
  "maximumAllowed" DOUBLE PRECISION,
  "maxRampPerMinute" DOUBLE PRECISION,
  "requestedById" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reason" TEXT NOT NULL,
  "source" "CommandSource" NOT NULL DEFAULT 'operator',
  "riskLevel" "CommandRiskLevel" NOT NULL DEFAULT 'medium',
  "requireSeparationOfDuties" BOOLEAN NOT NULL DEFAULT true,
  "optimisationRunId" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "status" "CommandRequestStatus" NOT NULL DEFAULT 'proposed',
  "overrideState" "CommandOverrideState" NOT NULL DEFAULT 'none',
  "advisoryOnly" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommandRequest_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CommandRequest_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CommandRequest_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CommandRequest_targetAssetId_fkey" FOREIGN KEY ("targetAssetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CommandRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "CommandRequest_organisationId_status_idx" ON "CommandRequest"("organisationId", "status");
CREATE INDEX IF NOT EXISTS "CommandRequest_siteId_status_idx" ON "CommandRequest"("siteId", "status");
CREATE INDEX IF NOT EXISTS "CommandRequest_plantId_status_idx" ON "CommandRequest"("plantId", "status");
CREATE INDEX IF NOT EXISTS "CommandRequest_targetAssetId_requestedAt_idx" ON "CommandRequest"("targetAssetId", "requestedAt");
CREATE INDEX IF NOT EXISTS "CommandRequest_status_expiresAt_idx" ON "CommandRequest"("status", "expiresAt");
CREATE INDEX IF NOT EXISTS "CommandRequest_requestedById_idx" ON "CommandRequest"("requestedById");

CREATE TABLE IF NOT EXISTS "CommandApproval" (
  "id" TEXT PRIMARY KEY,
  "commandRequestId" TEXT NOT NULL,
  "approverId" TEXT,
  "decision" "CommandApprovalDecision" NOT NULL,
  "reason" TEXT,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommandApproval_commandRequestId_fkey" FOREIGN KEY ("commandRequestId") REFERENCES "CommandRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CommandApproval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "CommandApproval_commandRequestId_timestamp_idx" ON "CommandApproval"("commandRequestId", "timestamp");
CREATE INDEX IF NOT EXISTS "CommandApproval_approverId_idx" ON "CommandApproval"("approverId");

CREATE TABLE IF NOT EXISTS "CommandExecution" (
  "id" TEXT PRIMARY KEY,
  "commandRequestId" TEXT NOT NULL,
  "executorMode" TEXT NOT NULL DEFAULT 'simulated',
  "sentAt" TIMESTAMP(3),
  "acknowledgedAt" TIMESTAMP(3),
  "readBackAt" TIMESTAMP(3),
  "expectedValue" DOUBLE PRECISION,
  "readBackValue" DOUBLE PRECISION,
  "status" "CommandExecutionStatus" NOT NULL DEFAULT 'queued',
  "failureReason" TEXT,
  "rollbackStatus" TEXT,
  "rawProtocolResponse" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommandExecution_commandRequestId_fkey" FOREIGN KEY ("commandRequestId") REFERENCES "CommandRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "CommandExecution_commandRequestId_createdAt_idx" ON "CommandExecution"("commandRequestId", "createdAt");
CREATE INDEX IF NOT EXISTS "CommandExecution_status_idx" ON "CommandExecution"("status");
