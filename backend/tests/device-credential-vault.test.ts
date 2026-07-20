import { createHash, randomBytes } from "node:crypto";

import { LocalDevDeviceSecretVault } from "../src/services/device-secret-vault/local-dev-vault.js";
import {
  buildGridFlexV1Canonical,
  createGridFlexV1Signature,
  fingerprintDeviceSecret,
  hashRawBody,
  safeSignatureEquals,
  zeroBuffer
} from "../src/utils/edgeDeviceAuth.js";

/**
 * Fixed GRIDFLEX-V1 test vector (TypeScript + ESP32 must match).
 *
 * deviceSecret (32 bytes, base64url):
 *   AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
 *   (32 zero bytes)
 *
 * rawBody UTF-8:
 *   {"current":11.2,"nodeId":"esp32-node-1","power":7.16,"voltage":640}
 */
describe("GRIDFLEX-V1 device signing", () => {
  const deviceSecret = Buffer.alloc(32, 0);
  const deviceSecretB64 = deviceSecret.toString("base64url");
  const rawBody =
    '{"current":11.2,"nodeId":"esp32-node-1","power":7.16,"voltage":640}';

  const input = {
    deviceId: "esp32-node-1",
    credentialId: "cred_testvector01",
    keyVersion: 1,
    timestamp: "1713187200000",
    nonce: "abc123nonce",
    sequenceNumber: 42,
    rawBody
  };

  it("builds canonical message with newline separators", () => {
    const canonical = buildGridFlexV1Canonical(input);
    const bodyHash = hashRawBody(rawBody);
    expect(canonical).toBe(
      [
        "GRIDFLEX-V1",
        "esp32-node-1",
        "cred_testvector01",
        "1",
        "1713187200000",
        "abc123nonce",
        "42",
        bodyHash
      ].join("\n")
    );
  });

  it("matches known HMAC-SHA256 base64url vector", () => {
    const signature = createGridFlexV1Signature(input, deviceSecret);
    const fromB64 = createGridFlexV1Signature(input, deviceSecretB64);
    expect(signature).toBe(fromB64);
    // Locked vector — update firmware examples when this changes.
    expect(signature).toBe("KjRhh4nKNGxQKSA23ezOUrC83LMmB7GX-NeC3mu8rh4");
  });

  it("hashes the exact raw body bytes (not re-serialized JSON)", () => {
    const compact = '{"a":1,"b":2}';
    const spaced = '{ "a": 1, "b": 2 }';
    expect(hashRawBody(compact)).not.toBe(hashRawBody(spaced));
  });

  it("rejects altered signatures via timing-safe compare", () => {
    const signature = createGridFlexV1Signature(input, deviceSecret);
    expect(safeSignatureEquals(signature, signature)).toBe(true);
    expect(safeSignatureEquals(signature, `${signature.slice(0, -1)}x`)).toBe(false);
  });

  it("fingerprints secrets without exposing them", () => {
    const fp = fingerprintDeviceSecret(deviceSecret);
    expect(fp).toHaveLength(64);
    expect(fp).toBe(createHash("sha256").update(deviceSecret).digest("hex"));
  });
});

describe("local device secret vault", () => {
  it("round-trips plaintext and never returns it from ciphertext alone without key", async () => {
    const vault = new LocalDevDeviceSecretVault(
      "dGVzdC1kZXZpY2Utc2VjcmV0LXZhdWx0LWtleS0zMiEh",
      "local-test"
    );
    const secret = randomBytes(32);
    const encrypted = await vault.encrypt(secret);
    expect(encrypted.ciphertext).not.toContain(secret.toString("base64url"));
    const decrypted = await vault.decrypt({
      ciphertext: encrypted.ciphertext,
      keyId: encrypted.keyId
    });
    expect(Buffer.compare(decrypted, secret)).toBe(0);
    zeroBuffer(secret);
    zeroBuffer(decrypted);
  });
});
