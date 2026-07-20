import { LocalDevDeviceSecretVault } from "../src/services/device-secret-vault/local-dev-vault.js";
import {
  createGridFlexV1Signature,
  fingerprintDeviceSecret
} from "../src/utils/edgeDeviceAuth.js";

const vault = new LocalDevDeviceSecretVault(
  "dGVzdC1kZXZpY2Utc2VjcmV0LXZhdWx0LWtleS0zMiEh",
  "local-test"
);

jest.mock("../src/services/device-secret-vault/index.js", () => ({
  getDeviceSecretVault: () => vault,
  resetDeviceSecretVaultForTests: jest.fn()
}));

jest.mock("../src/lib/edge-replay.js", () => ({
  assertAndStoreEdgeNonce: jest.fn().mockResolvedValue(undefined),
  clearEdgeReplayCache: jest.fn().mockResolvedValue(undefined)
}));

jest.mock("../src/services/device-credential.service.js", () => ({
  completeCredentialRotation: jest.fn().mockResolvedValue({ revoked: 0 }),
  provisionDeviceCredential: jest.fn(),
  revokeDeviceCredential: jest.fn(),
  listDeviceCredentials: jest.fn()
}));

jest.mock("../src/lib/prisma.js", () => ({
  prisma: {
    deviceCredential: {
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({})
    },
    edgeNode: {
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 0 })
    }
  }
}));

import type { NextFunction, Request, Response } from "express";

import { assertAndStoreEdgeNonce } from "../src/lib/edge-replay.js";
import { prisma } from "../src/lib/prisma.js";
import { verifyEdgeDeviceAuth } from "../src/middleware/edgeDeviceAuth.js";

const runAuth = (req: Partial<Request>) =>
  new Promise<{ error?: unknown; req: Request }>((resolve) => {
    const next: NextFunction = (err?: unknown) => {
      resolve({ error: err, req: req as Request });
    };
    verifyEdgeDeviceAuth(req as Request, {} as Response, next);
  });

describe("verifyEdgeDeviceAuth GRIDFLEX-V1", () => {
  const deviceSecret = Buffer.alloc(32, 0);
  const rawBody = Buffer.from(
    '{"current":11.2,"nodeId":"esp32-node-1","power":7.16,"voltage":640}',
    "utf8"
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("accepts a valid vaulted signature and advances sequence", async () => {
    const encrypted = await vault.encrypt(deviceSecret);
    (prisma.deviceCredential.findUnique as jest.Mock).mockResolvedValue({
      id: "row-1",
      credentialId: "cred_testvector01",
      keyVersion: 1,
      status: "active",
      expiresAt: null,
      lastSequenceNumber: 41,
      encryptedSecret: encrypted.ciphertext,
      encryptedDataKey: null,
      encryptionKeyId: encrypted.keyId,
      secretFingerprint: fingerprintDeviceSecret(deviceSecret),
      edgeNodeId: "node-1",
      edgeNode: { deviceKey: "esp32-node-1", isActive: true, id: "node-1" }
    });

    const timestamp = String(Date.now());
    const signature = createGridFlexV1Signature(
      {
        deviceId: "esp32-node-1",
        credentialId: "cred_testvector01",
        keyVersion: 1,
        timestamp,
        nonce: "nonce-ok",
        sequenceNumber: 42,
        rawBody
      },
      deviceSecret
    );

    const { error, req } = await runAuth({
      headers: {
        "x-gridflex-device-id": "esp32-node-1",
        "x-gridflex-credential-id": "cred_testvector01",
        "x-gridflex-key-version": "1",
        "x-gridflex-timestamp": timestamp,
        "x-gridflex-nonce": "nonce-ok",
        "x-gridflex-sequence-number": "42",
        "x-gridflex-signature": signature
      },
      rawBody,
      body: JSON.parse(rawBody.toString("utf8"))
    });

    expect(error).toBeUndefined();
    expect(req.edgeAuth?.mode).toBe("device_credential");
    expect(prisma.deviceCredential.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lastSequenceNumber: 42 })
      })
    );
  });

  it("rejects regressed sequence numbers", async () => {
    const encrypted = await vault.encrypt(deviceSecret);
    (prisma.deviceCredential.findUnique as jest.Mock).mockResolvedValue({
      id: "row-1",
      credentialId: "cred_testvector01",
      keyVersion: 1,
      status: "active",
      expiresAt: null,
      lastSequenceNumber: 100,
      encryptedSecret: encrypted.ciphertext,
      encryptedDataKey: null,
      encryptionKeyId: encrypted.keyId,
      edgeNodeId: "node-1",
      edgeNode: { deviceKey: "esp32-node-1", isActive: true, id: "node-1" }
    });

    const { error } = await runAuth({
      headers: {
        "x-gridflex-device-id": "esp32-node-1",
        "x-gridflex-credential-id": "cred_testvector01",
        "x-gridflex-key-version": "1",
        "x-gridflex-timestamp": String(Date.now()),
        "x-gridflex-nonce": "nonce-seq",
        "x-gridflex-sequence-number": "50",
        "x-gridflex-signature": "unused"
      },
      rawBody,
      body: {}
    });

    expect(error).toMatchObject({ statusCode: 409 });
  });

  it("treats equal sequence as idempotent replay (store-and-forward retry)", async () => {
    const encrypted = await vault.encrypt(deviceSecret);
    (prisma.deviceCredential.findUnique as jest.Mock).mockResolvedValue({
      id: "row-1",
      credentialId: "cred_testvector01",
      keyVersion: 1,
      status: "active",
      expiresAt: null,
      lastSequenceNumber: 42,
      encryptedSecret: encrypted.ciphertext,
      encryptedDataKey: null,
      encryptionKeyId: encrypted.keyId,
      secretFingerprint: fingerprintDeviceSecret(deviceSecret),
      edgeNodeId: "node-1",
      edgeNode: { deviceKey: "esp32-node-1", isActive: true, id: "node-1" }
    });

    const timestamp = String(Date.now());
    const signature = createGridFlexV1Signature(
      {
        deviceId: "esp32-node-1",
        credentialId: "cred_testvector01",
        keyVersion: 1,
        timestamp,
        nonce: "nonce-retry",
        sequenceNumber: 42,
        rawBody
      },
      deviceSecret
    );

    const { error, req } = await runAuth({
      headers: {
        "x-gridflex-device-id": "esp32-node-1",
        "x-gridflex-credential-id": "cred_testvector01",
        "x-gridflex-key-version": "1",
        "x-gridflex-timestamp": timestamp,
        "x-gridflex-nonce": "nonce-retry",
        "x-gridflex-sequence-number": "42",
        "x-gridflex-signature": signature
      },
      rawBody,
      body: JSON.parse(rawBody.toString("utf8"))
    });

    expect(error).toBeUndefined();
    expect(req.edgeAuth?.idempotentReplay).toBe(true);
    expect(prisma.deviceCredential.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ lastSequenceNumber: 42 })
      })
    );
  });

  it("rejects secretHash-only credentials (must re-provision)", async () => {
    (prisma.deviceCredential.findUnique as jest.Mock).mockResolvedValue({
      id: "row-legacy",
      credentialId: "cred_legacy",
      keyVersion: 1,
      status: "active",
      expiresAt: null,
      lastSequenceNumber: null,
      encryptedSecret: null,
      encryptionKeyId: null,
      secretHash: "abc",
      edgeNodeId: "node-1",
      edgeNode: { deviceKey: "esp32-node-1", isActive: true, id: "node-1" }
    });

    const { error } = await runAuth({
      headers: {
        "x-gridflex-device-id": "esp32-node-1",
        "x-gridflex-credential-id": "cred_legacy",
        "x-gridflex-key-version": "1",
        "x-gridflex-timestamp": String(Date.now()),
        "x-gridflex-nonce": "nonce-legacy",
        "x-gridflex-sequence-number": "1",
        "x-gridflex-signature": "x"
      },
      rawBody,
      body: {}
    });

    expect(error).toMatchObject({ statusCode: 401 });
    expect(String((error as Error).message)).toMatch(/re-provision/i);
  });

  it("stores nonces for replay protection", async () => {
    await runAuth({
      headers: {
        "x-gridflex-device-id": "esp32-node-1",
        "x-gridflex-timestamp": String(Date.now()),
        "x-gridflex-nonce": "nonce-replay-check",
        "x-gridflex-signature": "deadbeef"
      },
      body: {}
    });
    expect(assertAndStoreEdgeNonce).toHaveBeenCalledWith("esp32-node-1", "nonce-replay-check");
  });
});
