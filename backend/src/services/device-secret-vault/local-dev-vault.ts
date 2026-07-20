import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import type { DecryptInput, DeviceSecretVault, EncryptResult } from "./types.js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

/**
 * Test / local-dev vault. Uses a configured 256-bit key.
 * Must never be selected when NODE_ENV=production.
 */
export class LocalDevDeviceSecretVault implements DeviceSecretVault {
  private readonly key: Buffer;
  private readonly keyId: string;

  constructor(vaultKeyMaterial: string, keyId = "local-dev") {
    const trimmed = vaultKeyMaterial.trim();
    let key: Buffer;
    try {
      key = Buffer.from(trimmed, "base64");
    } catch {
      key = Buffer.alloc(0);
    }
    if (key.length !== 32) {
      // Deterministic derive for convenient local strings (never use in production).
      key = createHash("sha256").update(trimmed).digest();
    }
    this.key = key;
    this.keyId = keyId;
  }

  async encrypt(plaintext: Buffer): Promise<EncryptResult> {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();
    const packed = Buffer.concat([iv, authTag, encrypted]);
    return {
      ciphertext: packed.toString("base64url"),
      keyId: this.keyId
    };
  }

  async decrypt(input: DecryptInput): Promise<Buffer> {
    if (input.keyId !== this.keyId) {
      throw new Error(`Local vault key mismatch: expected ${this.keyId}, got ${input.keyId}`);
    }
    const packed = Buffer.from(input.ciphertext, "base64url");
    if (packed.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
      throw new Error("Invalid local vault ciphertext.");
    }
    const iv = packed.subarray(0, IV_LENGTH);
    const authTag = packed.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = packed.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  }
}
