-- AlterTable
ALTER TABLE "DeviceCredential" ADD COLUMN IF NOT EXISTS "lastAcceptedBodyHash" TEXT;
