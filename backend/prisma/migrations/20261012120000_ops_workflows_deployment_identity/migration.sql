-- AlterTable User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mustResetPassword" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable WorkOrder
ALTER TABLE "WorkOrder" ADD COLUMN IF NOT EXISTS "escalatedAt" TIMESTAMP(3);
ALTER TABLE "WorkOrder" ADD COLUMN IF NOT EXISTS "completionNotes" TEXT NOT NULL DEFAULT '';
ALTER TABLE "WorkOrder" ADD COLUMN IF NOT EXISTS "evidence" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "WorkOrder" ADD COLUMN IF NOT EXISTS "approvalStatus" TEXT NOT NULL DEFAULT 'none';

CREATE INDEX IF NOT EXISTS "WorkOrder_approvalStatus_updatedAt_idx" ON "WorkOrder"("approvalStatus", "updatedAt");

-- AlterTable AlarmRule
ALTER TABLE "AlarmRule" ADD COLUMN IF NOT EXISTS "notificationDestinations" JSONB NOT NULL DEFAULT '[]';

-- AlterTable AlarmEvent
ALTER TABLE "AlarmEvent" ADD COLUMN IF NOT EXISTS "assigneeUserId" TEXT;
ALTER TABLE "AlarmEvent" ADD COLUMN IF NOT EXISTS "escalationLevel" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AlarmEvent" ADD COLUMN IF NOT EXISTS "resolutionNotes" TEXT;
ALTER TABLE "AlarmEvent" ADD COLUMN IF NOT EXISTS "reopenedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "AlarmEvent_assigneeUserId_status_idx" ON "AlarmEvent"("assigneeUserId", "status");

DO $$ BEGIN
  ALTER TABLE "AlarmEvent" ADD CONSTRAINT "AlarmEvent_assigneeUserId_fkey"
    FOREIGN KEY ("assigneeUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "User_status_idx" ON "User"("status");

-- CreateTable DataQualityException
CREATE TABLE IF NOT EXISTS "DataQualityException" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT,
    "siteId" TEXT,
    "plantId" TEXT,
    "exceptionType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL DEFAULT '',
    "provenance" TEXT NOT NULL DEFAULT 'measured',
    "quality" TEXT NOT NULL DEFAULT 'uncertain',
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolutionNotes" TEXT NOT NULL DEFAULT '',
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "approvedByName" TEXT,
    "approvedAt" TIMESTAMP(3),
    "history" JSONB NOT NULL DEFAULT '[]',
    "releaseGitSha" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DataQualityException_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DataQualityException_organisationId_status_updatedAt_idx"
  ON "DataQualityException"("organisationId", "status", "updatedAt");
CREATE INDEX IF NOT EXISTS "DataQualityException_exceptionType_status_idx"
  ON "DataQualityException"("exceptionType", "status");
CREATE INDEX IF NOT EXISTS "DataQualityException_siteId_updatedAt_idx"
  ON "DataQualityException"("siteId", "updatedAt");

DO $$ BEGIN
  ALTER TABLE "DataQualityException" ADD CONSTRAINT "DataQualityException_organisationId_fkey"
    FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "DataQualityException" ADD CONSTRAINT "DataQualityException_resolvedById_fkey"
    FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable PilotOnboardingProgress
CREATE TABLE IF NOT EXISTS "PilotOnboardingProgress" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT,
    "siteId" TEXT,
    "stepId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "notes" TEXT NOT NULL DEFAULT '',
    "evidence" JSONB NOT NULL DEFAULT '{}',
    "updatedById" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PilotOnboardingProgress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PilotOnboardingProgress_organisationId_stepId_key"
  ON "PilotOnboardingProgress"("organisationId", "stepId");
CREATE INDEX IF NOT EXISTS "PilotOnboardingProgress_organisationId_status_idx"
  ON "PilotOnboardingProgress"("organisationId", "status");
CREATE INDEX IF NOT EXISTS "PilotOnboardingProgress_updatedById_updatedAt_idx"
  ON "PilotOnboardingProgress"("updatedById", "updatedAt");

DO $$ BEGIN
  ALTER TABLE "PilotOnboardingProgress" ADD CONSTRAINT "PilotOnboardingProgress_organisationId_fkey"
    FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PilotOnboardingProgress" ADD CONSTRAINT "PilotOnboardingProgress_updatedById_fkey"
    FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable DeploymentRecord
CREATE TABLE IF NOT EXISTS "DeploymentRecord" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT,
    "environment" TEXT NOT NULL,
    "gitSha" TEXT,
    "imageDigest" TEXT,
    "migrationVersion" TEXT,
    "cosignVerified" BOOLEAN NOT NULL DEFAULT false,
    "requireIdentity" BOOLEAN NOT NULL DEFAULT true,
    "serviceName" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "deployedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeploymentRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DeploymentRecord_environment_deployedAt_idx"
  ON "DeploymentRecord"("environment", "deployedAt");
CREATE INDEX IF NOT EXISTS "DeploymentRecord_gitSha_deployedAt_idx"
  ON "DeploymentRecord"("gitSha", "deployedAt");
CREATE INDEX IF NOT EXISTS "DeploymentRecord_imageDigest_idx"
  ON "DeploymentRecord"("imageDigest");

DO $$ BEGIN
  ALTER TABLE "DeploymentRecord" ADD CONSTRAINT "DeploymentRecord_organisationId_fkey"
    FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
