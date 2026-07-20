export type EncryptResult = {
  ciphertext: string;
  keyId: string;
  encryptedDataKey?: string;
};

export type DecryptInput = {
  ciphertext: string;
  keyId: string;
  encryptedDataKey?: string;
};

/**
 * Envelope encryption for device HMAC secrets.
 * Plaintext must never be persisted; only ciphertext + key metadata are stored.
 */
export interface DeviceSecretVault {
  encrypt(plaintext: Buffer): Promise<EncryptResult>;
  decrypt(input: DecryptInput): Promise<Buffer>;
}
