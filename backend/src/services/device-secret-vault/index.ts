import { env } from "../../config/env.js";
import { LocalDevDeviceSecretVault } from "./local-dev-vault.js";
import {
  AwsKmsDeviceSecretVault,
  AzureKeyVaultDeviceSecretVault,
  GcpKmsDeviceSecretVault
} from "./managed-kms-vault.js";
import type { DeviceSecretVault } from "./types.js";

let cachedVault: DeviceSecretVault | null = null;

/**
 * Resolve the device secret vault for this process.
 * Production: aws_kms (required). Dev/CI: local AES with DEVICE_SECRET_VAULT_KEY.
 */
export const getDeviceSecretVault = (): DeviceSecretVault => {
  if (cachedVault) {
    return cachedVault;
  }

  const provider = env.DEVICE_SECRET_VAULT_PROVIDER;

  if (provider === "local") {
    if (env.NODE_ENV === "production") {
      throw new Error(
        "DEVICE_SECRET_VAULT_PROVIDER=local is forbidden in production. Use aws_kms with AWS_KMS_KEY_ID."
      );
    }
    const material = env.DEVICE_SECRET_VAULT_KEY;
    if (!material) {
      throw new Error("DEVICE_SECRET_VAULT_KEY is required when DEVICE_SECRET_VAULT_PROVIDER=local.");
    }
    cachedVault = new LocalDevDeviceSecretVault(material, env.DEVICE_SECRET_VAULT_KEY_ID);
    return cachedVault;
  }

  if (provider === "aws_kms") {
    const keyId = env.AWS_KMS_KEY_ID;
    if (!keyId) {
      throw new Error("AWS_KMS_KEY_ID is required when DEVICE_SECRET_VAULT_PROVIDER=aws_kms.");
    }
    cachedVault = new AwsKmsDeviceSecretVault(keyId);
    return cachedVault;
  }

  if (provider === "azure_key_vault") {
    cachedVault = new AzureKeyVaultDeviceSecretVault();
    return cachedVault;
  }

  if (provider === "gcp_kms") {
    cachedVault = new GcpKmsDeviceSecretVault();
    return cachedVault;
  }

  throw new Error(`Unsupported DEVICE_SECRET_VAULT_PROVIDER: ${String(provider)}`);
};

/** Test helper — clears the singleton between suites. */
export const resetDeviceSecretVaultForTests = (): void => {
  cachedVault = null;
};

export type { DeviceSecretVault, DecryptInput, EncryptResult } from "./types.js";
