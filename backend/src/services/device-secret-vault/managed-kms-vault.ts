import type { DecryptInput, DeviceSecretVault, EncryptResult } from "./types.js";

type KmsClientLike = {
  send(command: unknown): Promise<{ CiphertextBlob?: Uint8Array; Plaintext?: Uint8Array }>;
};

/**
 * AWS KMS envelope encryption for production.
 * Encrypts the device secret directly with EncryptCommand when using a CMK,
 * and supports DecryptCommand for retrieval.
 *
 * Requires @aws-sdk/client-kms at runtime when provider=aws_kms.
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
          return new mod.KMSClient({}) as unknown as KmsClientLike;
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
        Plaintext: plaintext
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
        KeyId: input.keyId
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
