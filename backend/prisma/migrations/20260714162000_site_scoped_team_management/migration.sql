-- Assign managers and operators to a specific plant/site.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "siteId" TEXT;

CREATE INDEX IF NOT EXISTS "User_siteId_idx" ON "User"("siteId");

DO $$ BEGIN
  ALTER TABLE "User" ADD CONSTRAINT "User_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
