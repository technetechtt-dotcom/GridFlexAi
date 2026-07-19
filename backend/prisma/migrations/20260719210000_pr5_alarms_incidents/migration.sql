-- PR5: tenant-scoped alarms, acknowledgements, and incidents.

DO $$ BEGIN CREATE TYPE "AlarmSeverity" AS ENUM (
  'info',
  'warning',
  'major',
  'critical'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE "AlarmStatus" AS ENUM (
  'active',
  'acknowledged',
  'cleared',
  'suppressed'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE "AlarmComparator" AS ENUM (
  'gt',
  'gte',
  'lt',
  'lte',
  'eq',
  'neq'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE "IncidentStatus" AS ENUM (
  'open',
  'investigating',
  'mitigated',
  'resolved',
  'closed'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "AlarmRule" (
  "id" TEXT PRIMARY KEY,
  "organisationId" TEXT NOT NULL,
  "siteId" TEXT,
  "plantId" TEXT,
  "assetId" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "metricKey" TEXT NOT NULL,
  "comparator" "AlarmComparator" NOT NULL DEFAULT 'gt',
  "threshold" DOUBLE PRECISION NOT NULL,
  "severity" "AlarmSeverity" NOT NULL DEFAULT 'warning',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "cooldownSeconds" INTEGER NOT NULL DEFAULT 300,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AlarmRule_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AlarmRule_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AlarmRule_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "AlarmRule_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "AlarmRule_organisationId_enabled_idx" ON "AlarmRule"("organisationId", "enabled");
CREATE INDEX IF NOT EXISTS "AlarmRule_siteId_metricKey_idx" ON "AlarmRule"("siteId", "metricKey");
CREATE INDEX IF NOT EXISTS "AlarmRule_plantId_idx" ON "AlarmRule"("plantId");
CREATE INDEX IF NOT EXISTS "AlarmRule_assetId_idx" ON "AlarmRule"("assetId");

CREATE TABLE IF NOT EXISTS "AlarmEvent" (
  "id" TEXT PRIMARY KEY,
  "organisationId" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "plantId" TEXT,
  "assetId" TEXT,
  "ruleId" TEXT,
  "incidentId" TEXT,
  "severity" "AlarmSeverity" NOT NULL DEFAULT 'warning',
  "status" "AlarmStatus" NOT NULL DEFAULT 'active',
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "metricKey" TEXT,
  "metricValue" DOUBLE PRECISION,
  "threshold" DOUBLE PRECISION,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "clearedAt" TIMESTAMP(3),
  "metadata" JSONB,
  CONSTRAINT "AlarmEvent_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AlarmEvent_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AlarmEvent_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "AlarmEvent_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "AlarmEvent_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AlarmRule"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "AlarmEvent_organisationId_status_startedAt_idx" ON "AlarmEvent"("organisationId", "status", "startedAt");
CREATE INDEX IF NOT EXISTS "AlarmEvent_siteId_status_startedAt_idx" ON "AlarmEvent"("siteId", "status", "startedAt");
CREATE INDEX IF NOT EXISTS "AlarmEvent_ruleId_startedAt_idx" ON "AlarmEvent"("ruleId", "startedAt");
CREATE INDEX IF NOT EXISTS "AlarmEvent_incidentId_idx" ON "AlarmEvent"("incidentId");

CREATE TABLE IF NOT EXISTS "AlarmAcknowledgement" (
  "id" TEXT PRIMARY KEY,
  "alarmEventId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "note" TEXT,
  "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AlarmAcknowledgement_alarmEventId_fkey" FOREIGN KEY ("alarmEventId") REFERENCES "AlarmEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AlarmAcknowledgement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "AlarmAcknowledgement_alarmEventId_acknowledgedAt_idx" ON "AlarmAcknowledgement"("alarmEventId", "acknowledgedAt");
CREATE INDEX IF NOT EXISTS "AlarmAcknowledgement_userId_acknowledgedAt_idx" ON "AlarmAcknowledgement"("userId", "acknowledgedAt");

CREATE TABLE IF NOT EXISTS "Incident" (
  "id" TEXT PRIMARY KEY,
  "organisationId" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "plantId" TEXT,
  "status" "IncidentStatus" NOT NULL DEFAULT 'open',
  "severity" "AlarmSeverity" NOT NULL DEFAULT 'major',
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMP(3),
  "openedById" TEXT,
  CONSTRAINT "Incident_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Incident_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Incident_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Incident_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Incident_organisationId_status_openedAt_idx" ON "Incident"("organisationId", "status", "openedAt");
CREATE INDEX IF NOT EXISTS "Incident_siteId_status_openedAt_idx" ON "Incident"("siteId", "status", "openedAt");
CREATE INDEX IF NOT EXISTS "Incident_openedById_idx" ON "Incident"("openedById");

CREATE TABLE IF NOT EXISTS "IncidentTimeline" (
  "id" TEXT PRIMARY KEY,
  "incidentId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "eventType" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IncidentTimeline_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "IncidentTimeline_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "IncidentTimeline_incidentId_createdAt_idx" ON "IncidentTimeline"("incidentId", "createdAt");
CREATE INDEX IF NOT EXISTS "IncidentTimeline_actorUserId_idx" ON "IncidentTimeline"("actorUserId");

DO $$ BEGIN
  ALTER TABLE "AlarmEvent"
    ADD CONSTRAINT "AlarmEvent_incidentId_fkey"
    FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
