-- Edge reliability fields referenced by schema + ingest path but missing from DB.
ALTER TABLE "EdgeNode"
  ADD COLUMN IF NOT EXISTS "lastResetReason" TEXT,
  ADD COLUMN IF NOT EXISTS "appliedConfigVersion" TEXT;
