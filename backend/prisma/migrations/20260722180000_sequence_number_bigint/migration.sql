-- Sequence / watermark columns: INT4 → BIGINT (edge ingest can exceed 2^31-1).
ALTER TABLE "SensorReading" ALTER COLUMN "sequenceNumber" TYPE BIGINT USING "sequenceNumber"::BIGINT;
ALTER TABLE "EdgeIngestReceipt" ALTER COLUMN "sequenceNumber" TYPE BIGINT USING "sequenceNumber"::BIGINT;
ALTER TABLE "TelemetryReading" ALTER COLUMN "sequenceNumber" TYPE BIGINT USING "sequenceNumber"::BIGINT;
ALTER TABLE "DeviceCredential" ALTER COLUMN "lastSequenceNumber" TYPE BIGINT USING "lastSequenceNumber"::BIGINT;
