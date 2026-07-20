import type { DecryptInput, DeviceSecretVault, EncryptResult } from "./types.js";

type KmsClientLike = {
  send(command: unknown): Promise<{ CiphertextBlob?: Uint8Array; Plaintext?: Uint8Array }>;
};

const encryptionContext = (): Record<string, string> => ({
  application: "gridflex",
  purpose: "device-hmac-secret"
});

/**
 * AWS KMS encryption for device HMAC secrets at rest.
 * Uses EncryptCommand / DecryptCommand with a dedicated CMK.
 *
 * Requires:
 * - DEVICE_SECRET_VAULT_PROVIDER=aws_kms
 * - AWS_KMS_KEY_ID (key id or ARN)
 * - AWS credentials (env, instance role, or Render secret)
 * - AWS_REGION (recommended)
 */
export class AwsKmsDeviceSecretVault implements DeviceSecretVault {
  private clientPromise: Promise<KmsClientLike> | null = null;

  constructor(private readonly keyId: string) {
    if (!keyId.trim()) {
      throw new Error("AWS_KMS_KEY_ID is required for aws_kms device secret vault.");
    }
  }

  private async getClient(): Promise<KmsClientLike> {
    if (!this.clientPromise) {
      this.clientPromise = (async () => {
        try {
          const mod = await import("@aws-sdk/client-kms");
          const region =
            process.env.AWS_REGION?.trim() ||
            process.env.AWS_DEFAULT_REGION?.trim() ||
            undefined;
          return new mod.KMSClient(region ? { region } : {}) as unknown as KmsClientLike;
        } catch {
          throw new Error(
            "AWS KMS vault requires @aws-sdk/client-kms. Install it and set AWS credentials / AWS_KMS_KEY_ID."
          );
        }
      })();
    }
    return this.clientPromise;
  }

  async encrypt(plaintext: Buffer): Promise<EncryptResult> {
    const mod = await import("@aws-sdk/client-kms");
    const client = await this.getClient();
    const response = await client.send(
      new mod.EncryptCommand({
        KeyId: this.keyId,
        Plaintext: plaintext,
        EncryptionContext: encryptionContext()
      })
    );
    if (!response.CiphertextBlob) {
      throw new Error("AWS KMS encrypt returned empty ciphertext.");
    }
    return {
      ciphertext: Buffer.from(response.CiphertextBlob).toString("base64url"),
      keyId: this.keyId
    };
  }

  async decrypt(input: DecryptInput): Promise<Buffer> {
    const mod = await import("@aws-sdk/client-kms");
    const client = await this.getClient();
    const response = await client.send(
      new mod.DecryptCommand({
        CiphertextBlob: Buffer.from(input.ciphertext, "base64url"),
        // KeyId is optional on decrypt when ciphertext embeds it; pass when stored.
        ...(input.keyId ? { KeyId: input.keyId } : {}),
        EncryptionContext: encryptionContext()
      })
    );
    if (!response.Plaintext) {
      throw new Error("AWS KMS decrypt returned empty plaintext.");
    }
    return Buffer.from(response.Plaintext);
  }
}

/**
 * Placeholders for later industrial releases. Fail closed until implemented.
 */
export class AzureKeyVaultDeviceSecretVault implements DeviceSecretVault {
  async encrypt(_plaintext: Buffer): Promise<EncryptResult> {
    throw new Error("Azure Key Vault device secret vault is not implemented yet.");
  }

  async decrypt(_input: DecryptInput): Promise<Buffer> {
    throw new Error("Azure Key Vault device secret vault is not implemented yet.");
  }
}

export class GcpKmsDeviceSecretVault implements DeviceSecretVault {
  async encrypt(_plaintext: Buffer): Promise<EncryptResult> {
    throw new Error("Google Cloud KMS device secret vault is not implemented yet.");
  }

  async decrypt(_input: DecryptInput): Promise<Buffer> {
    throw new Error("Google Cloud KMS device secret vault is not implemented yet.");
  }
}

/** Exported for tests — must match encrypt/decrypt context. */
export const awsKmsEncryptionContextForTests = encryptionContext;
