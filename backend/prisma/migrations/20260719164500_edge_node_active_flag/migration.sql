-- Additive compatibility fix: the schema and node services require this flag,
-- but earlier node-management migrations did not create it.
ALTER TABLE "EdgeNode"
  ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
