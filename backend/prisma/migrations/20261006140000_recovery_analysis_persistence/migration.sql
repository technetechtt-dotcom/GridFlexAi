-- CreateEnum
CREATE TYPE "RecoveryAnalysisStatus" AS ENUM ('open', 'under_review', 'confirmed', 'dismissed');

-- CreateEnum
CREATE TYPE "RecoveryCauseCode" AS ENUM ('none', 'grid_instruction', 'equipment_fault', 'export_limit', 'weather', 'performance_gap');

-- CreateTable
CREATE TABLE "RecoveryAnalysisRun" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "siteId" TEXT,
    "plantId" TEXT,
    "environment" "TelemetryEnvironment" NOT NULL DEFAULT 'simulation',
    "status" "RecoveryAnalysisStatus" NOT NULL DEFAULT 'open',
    "dominantCause" "RecoveryCauseCode" NOT NULL DEFAULT 'none',
    "causeConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "algorithmVersion" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "expectedEnergyKwh" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actualEnergyKwh" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lostEnergyKwh" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "revenueAtRiskZar" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "carbonOpportunityKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "affectedIntervals" INTEGER NOT NULL DEFAULT 0,
    "affectedDurationHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "assumptionsJson" JSONB NOT NULL,
    "analysisJson" JSONB NOT NULL,
    "provenanceJson" JSONB NOT NULL,
    "recommendation" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecoveryAnalysisRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecoveryEvidence" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "sourceType" "DataSourceType" NOT NULL DEFAULT 'simulated',
    "measurementKey" TEXT NOT NULL,
    "numericValue" DOUBLE PRECISION,
    "quality" "DataQuality" NOT NULL DEFAULT 'unverified',
    "provenanceNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecoveryEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecoveryOpportunityRow" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "opportunityType" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "recoverableEnergyKwh" DOUBLE PRECISION NOT NULL,
    "estimatedGrossValueZar" DOUBLE PRECISION NOT NULL,
    "ranking" INTEGER NOT NULL,
    "readiness" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecoveryOpportunityRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecoveryReview" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "decision" "RecoveryAnalysisStatus" NOT NULL,
    "correctedCause" "RecoveryCauseCode",
    "notes" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecoveryReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecoveryAnalysisRun_organisationId_createdAt_idx" ON "RecoveryAnalysisRun"("organisationId", "createdAt");
CREATE INDEX "RecoveryAnalysisRun_siteId_createdAt_idx" ON "RecoveryAnalysisRun"("siteId", "createdAt");
CREATE INDEX "RecoveryAnalysisRun_plantId_createdAt_idx" ON "RecoveryAnalysisRun"("plantId", "createdAt");
CREATE INDEX "RecoveryAnalysisRun_status_dominantCause_idx" ON "RecoveryAnalysisRun"("status", "dominantCause");
CREATE INDEX "RecoveryAnalysisRun_algorithmVersion_idx" ON "RecoveryAnalysisRun"("algorithmVersion");
CREATE INDEX "RecoveryAnalysisRun_environment_createdAt_idx" ON "RecoveryAnalysisRun"("environment", "createdAt");
CREATE INDEX "RecoveryEvidence_analysisId_timestamp_idx" ON "RecoveryEvidence"("analysisId", "timestamp");
CREATE INDEX "RecoveryOpportunityRow_analysisId_ranking_idx" ON "RecoveryOpportunityRow"("analysisId", "ranking");
CREATE INDEX "RecoveryReview_analysisId_createdAt_idx" ON "RecoveryReview"("analysisId", "createdAt");
CREATE INDEX "RecoveryReview_reviewerId_idx" ON "RecoveryReview"("reviewerId");

-- AddForeignKey
ALTER TABLE "RecoveryAnalysisRun" ADD CONSTRAINT "RecoveryAnalysisRun_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecoveryAnalysisRun" ADD CONSTRAINT "RecoveryAnalysisRun_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RecoveryAnalysisRun" ADD CONSTRAINT "RecoveryAnalysisRun_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RecoveryAnalysisRun" ADD CONSTRAINT "RecoveryAnalysisRun_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RecoveryEvidence" ADD CONSTRAINT "RecoveryEvidence_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "RecoveryAnalysisRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecoveryOpportunityRow" ADD CONSTRAINT "RecoveryOpportunityRow_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "RecoveryAnalysisRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecoveryReview" ADD CONSTRAINT "RecoveryReview_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "RecoveryAnalysisRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecoveryReview" ADD CONSTRAINT "RecoveryReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
