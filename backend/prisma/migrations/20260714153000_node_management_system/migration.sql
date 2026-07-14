-- Extend node lifecycle states.
ALTER TYPE "NodeStatus" ADD VALUE IF NOT EXISTS 'maintenance';

-- Add Edge Node metadata needed by Ops Center and client dashboards.
ALTER TABLE "EdgeNode"
  ADD COLUMN IF NOT EXISTS "serialNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "firmwareVersion" TEXT,
  ADD COLUMN IF NOT EXISTS "batteryLevel" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "signalStrength" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "lastRestartedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS "EdgeNode_serialNumber_key" ON "EdgeNode"("serialNumber");
CREATE INDEX IF NOT EXISTS "EdgeNode_serialNumber_idx" ON "EdgeNode"("serialNumber");

-- Status/history log for node lifecycle changes, commands, and metadata actions.
CREATE TABLE IF NOT EXISTS "EdgeNodeStatusLog" (
  "id" TEXT NOT NULL,
  "nodeId" TEXT NOT NULL,
  "fromStatus" "NodeStatus",
  "toStatus" "NodeStatus" NOT NULL,
  "action" TEXT NOT NULL,
  "message" TEXT,
  "metadata" JSONB,
  "userId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "EdgeNodeStatusLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EdgeNodeStatusLog_nodeId_createdAt_idx" ON "EdgeNodeStatusLog"("nodeId", "createdAt");
CREATE INDEX IF NOT EXISTS "EdgeNodeStatusLog_toStatus_idx" ON "EdgeNodeStatusLog"("toStatus");

DO $$ BEGIN
  ALTER TABLE "EdgeNodeStatusLog" ADD CONSTRAINT "EdgeNodeStatusLog_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "EdgeNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Client-facing maintenance / issue requests against a node.
CREATE TABLE IF NOT EXISTS "NodeMaintenanceRequest" (
  "id" TEXT NOT NULL,
  "nodeId" TEXT NOT NULL,
  "requestedById" TEXT,
  "issueType" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),

  CONSTRAINT "NodeMaintenanceRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "NodeMaintenanceRequest_nodeId_createdAt_idx" ON "NodeMaintenanceRequest"("nodeId", "createdAt");
CREATE INDEX IF NOT EXISTS "NodeMaintenanceRequest_status_idx" ON "NodeMaintenanceRequest"("status");

DO $$ BEGIN
  ALTER TABLE "NodeMaintenanceRequest" ADD CONSTRAINT "NodeMaintenanceRequest_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "EdgeNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
