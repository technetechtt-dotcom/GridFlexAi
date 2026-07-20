-- Separate simulation / HIL telemetry from live plant readings.

CREATE TYPE "TelemetryEnvironment" AS ENUM ('live', 'simulation', 'hil');

ALTER TABLE "SensorReading" ADD COLUMN "environment" "TelemetryEnvironment" NOT NULL DEFAULT 'live';
ALTER TABLE "SensorReading" ADD COLUMN "simulationRunId" TEXT;

ALTER TABLE "TelemetryReading" ADD COLUMN "environment" "TelemetryEnvironment" NOT NULL DEFAULT 'live';
ALTER TABLE "TelemetryReading" ADD COLUMN "simulationRunId" TEXT;

CREATE INDEX "SensorReading_environment_idx" ON "SensorReading"("environment");
CREATE INDEX "SensorReading_simulationRunId_idx" ON "SensorReading"("simulationRunId");
CREATE INDEX "TelemetryReading_environment_idx" ON "TelemetryReading"("environment");
CREATE INDEX "TelemetryReading_simulationRunId_idx" ON "TelemetryReading"("simulationRunId");
