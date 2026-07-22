CREATE TYPE "SimulationRunStatus" AS ENUM ('running', 'stopped', 'failed');

CREATE TABLE "SimulationRun" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "targetNodeId" TEXT NOT NULL,
    "status" "SimulationRunStatus" NOT NULL DEFAULT 'running',
    "createdById" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stoppedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SimulationRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SimulationRun_organisationId_createdAt_idx" ON "SimulationRun"("organisationId", "createdAt");
CREATE INDEX "SimulationRun_siteId_createdAt_idx" ON "SimulationRun"("siteId", "createdAt");
CREATE INDEX "SimulationRun_targetNodeId_status_idx" ON "SimulationRun"("targetNodeId", "status");
CREATE INDEX "SimulationRun_status_startedAt_idx" ON "SimulationRun"("status", "startedAt");
CREATE INDEX "SimulationRun_createdById_idx" ON "SimulationRun"("createdById");

ALTER TABLE "SimulationRun"
ADD CONSTRAINT "SimulationRun_organisationId_fkey"
FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SimulationRun"
ADD CONSTRAINT "SimulationRun_siteId_fkey"
FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SimulationRun"
ADD CONSTRAINT "SimulationRun_targetNodeId_fkey"
FOREIGN KEY ("targetNodeId") REFERENCES "EdgeNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SimulationRun"
ADD CONSTRAINT "SimulationRun_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Preserve legacy simulated SensorReading provenance only when one legacy run
-- resolves unambiguously to one active node, site and organisation.
WITH "LegacyRuns" AS (
    SELECT
        sr."simulationRunId" AS "id",
        MIN(sr."nodeId") AS "targetNodeId",
        MIN(n."siteId") AS "siteId",
        MIN(COALESCE(s."organisationId", c."organisationId")) AS "organisationId",
        MIN(COALESCE(sr."deviceTimestamp", sr."timestamp")) AS "startedAt",
        MAX(COALESCE(sr."deviceTimestamp", sr."timestamp")) AS "stoppedAt"
    FROM "SensorReading" sr
    JOIN "EdgeNode" n ON n."id" = sr."nodeId"
    JOIN "Site" s ON s."id" = n."siteId"
    JOIN "Client" c ON c."id" = s."clientId"
    WHERE sr."simulationRunId" IS NOT NULL
      AND COALESCE(s."organisationId", c."organisationId") IS NOT NULL
    GROUP BY sr."simulationRunId"
    HAVING COUNT(DISTINCT sr."nodeId") = 1
       AND COUNT(DISTINCT n."siteId") = 1
       AND COUNT(DISTINCT COALESCE(s."organisationId", c."organisationId")) = 1
)
INSERT INTO "SimulationRun" (
    "id", "organisationId", "siteId", "targetNodeId", "status",
    "startedAt", "stoppedAt", "createdAt", "updatedAt"
)
SELECT
    "id", "organisationId", "siteId", "targetNodeId", 'stopped',
    "startedAt", "stoppedAt", "startedAt", CURRENT_TIMESTAMP
FROM "LegacyRuns"
ON CONFLICT ("id") DO NOTHING;

-- Quarantine unresolved or tenant-inconsistent legacy references by clearing
-- only the optional link; the telemetry rows themselves are retained.
UPDATE "SensorReading" sr
SET "simulationRunId" = NULL
WHERE sr."simulationRunId" IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM "SimulationRun" run
      JOIN "EdgeNode" n ON n."id" = sr."nodeId"
      WHERE run."id" = sr."simulationRunId"
        AND run."targetNodeId" = sr."nodeId"
        AND run."siteId" = n."siteId"
  );

UPDATE "TelemetryReading" tr
SET "simulationRunId" = NULL
WHERE tr."simulationRunId" IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM "SimulationRun" run
      WHERE run."id" = tr."simulationRunId"
        AND run."organisationId" = tr."organisationId"
        AND run."siteId" = tr."siteId"
  );

ALTER TABLE "SensorReading"
ADD CONSTRAINT "SensorReading_simulationRunId_fkey"
FOREIGN KEY ("simulationRunId") REFERENCES "SimulationRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TelemetryReading"
ADD CONSTRAINT "TelemetryReading_simulationRunId_fkey"
FOREIGN KEY ("simulationRunId") REFERENCES "SimulationRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
