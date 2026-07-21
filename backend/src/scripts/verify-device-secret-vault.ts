import { randomBytes, timingSafeEqual } from "node:crypto";

import { env } from "../config/env.js";
import { getDeviceSecretVault } from "../services/device-secret-vault/index.js";

const verifyVaultRoundTrip = async (): Promise<void> => {
  const plaintext = randomBytes(32);
  const vault = getDeviceSecretVault();
  const encrypted = await vault.encrypt(plaintext);
  const decrypted = await vault.decrypt(encrypted);

  if (decrypted.length !== plaintext.length || !timingSafeEqual(decrypted, plaintext)) {
    throw new Error("Device secret vault round-trip returned different plaintext.");
  }

  process.stdout.write(
    JSON.stringify({
      event: "device_secret_vault.round_trip_ok",
      provider: env.DEVICE_SECRET_VAULT_PROVIDER,
      keyId: encrypted.keyId
    }) + "\n"
  );
};

verifyVaultRoundTrip().catch((error) => {
  process.stderr.write(
    JSON.stringify({
      event: "device_secret_vault.round_trip_failed",
      provider: env.DEVICE_SECRET_VAULT_PROVIDER,
      error: error instanceof Error ? error.message : String(error)
    }) + "\n"
  );
  process.exit(1);
});
