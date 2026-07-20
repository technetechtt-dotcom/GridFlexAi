-- Device credential vault: envelope-encrypted secrets + fingerprint + sequence tracking.
-- Existing rows keep secretHash only; they must be re-provisioned (encryptedSecret required for auth).

ALTER TABLE "DeviceCredential" ALTER COLUMN "secretHash" DROP NOT NULL;

ALTER TABLE "DeviceCredential" ADD COLUMN "encryptedSecret" TEXT;
ALTER TABLE "DeviceCredential" ADD COLUMN "encryptedDataKey" TEXT;
ALTER TABLE "DeviceCredential" ADD COLUMN "secretFingerprint" TEXT;
ALTER TABLE "DeviceCredential" ADD COLUMN "encryptionKeyId" TEXT;
ALTER TABLE "DeviceCredential" ADD COLUMN "algorithm" TEXT NOT NULL DEFAULT 'HMAC-SHA256';
ALTER TABLE "DeviceCredential" ADD COLUMN "lastSequenceNumber" INTEGER;

CREATE INDEX "DeviceCredential_secretFingerprint_idx" ON "DeviceCredential"("secretFingerprint");
