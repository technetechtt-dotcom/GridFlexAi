import { DeviceCredentialStatus, Prisma } from "@prisma/client";
import { randomBytes } from "node:crypto";

import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/AppError.js";
import { fingerprintDeviceSecret, zeroBuffer } from "../utils/edgeDeviceAuth.js";
import { recordAuditLog } from "./audit-log.service.js";
import { getDeviceSecretVault } from "./device-secret-vault/index.js";

export const provisionDeviceCredential = async (input: {
  edgeNodeId: string;
  actorId: string;
  expiresAt?: Date;
}) => {
  const node = await prisma.edgeNode.findUnique({ where: { id: input.edgeNodeId } });
  if (!node) {
    throw new AppError("Edge node not found.", 404);
  }

  const secret = randomBytes(32);
  const fingerprint = fingerprintDeviceSecret(secret);
  const credentialId = `cred_${randomBytes(12).toString("hex")}`;
  const vault = getDeviceSecretVault();

  let encrypted: { ciphertext: string; keyId: string; encryptedDataKey?: string };
  try {
    encrypted = await vault.encrypt(secret);
  } catch (error) {
    zeroBuffer(secret);
    throw error;
  }

  const latest = await prisma.deviceCredential.findFirst({
    where: { edgeNodeId: input.edgeNodeId },
    orderBy: { keyVersion: "desc" }
  });

  const credential = await prisma.$transaction(async (tx) => {
    if (latest && latest.status === DeviceCredentialStatus.active) {
      await tx.deviceCredential.update({
        where: { id: latest.id },
        data: {
          status: DeviceCredentialStatus.rotating,
          rotatedAt: new Date()
        }
      });
    }

    return tx.deviceCredential.create({
      data: {
        edgeNodeId: input.edgeNodeId,
        credentialId,
        secretHash: null,
        encryptedSecret: encrypted.ciphertext,
        encryptedDataKey: encrypted.encryptedDataKey ?? null,
        secretFingerprint: fingerprint,
        encryptionKeyId: encrypted.keyId,
        algorithm: "HMAC-SHA256",
        keyVersion: (latest?.keyVersion ?? 0) + 1,
        status: DeviceCredentialStatus.active,
        expiresAt: input.expiresAt ?? null
      }
    });
  });

  const plaintextOnce = secret.toString("base64url");
  zeroBuffer(secret);

  await prisma.deviceProvisioningEvent.create({
    data: {
      edgeNodeId: input.edgeNodeId,
      action: "credential.provision",
      actorId: input.actorId,
      metadata: {
        credentialId: credential.credentialId,
        keyVersion: credential.keyVersion,
        secretFingerprint: fingerprint,
        encryptionKeyId: encrypted.keyId
      } as Prisma.InputJsonValue
    }
  });

  await recordAuditLog({
    action: "device.credential.provision",
    entityType: "DeviceCredential",
    entityId: credential.id,
    message: `Provisioned vaulted device credential for node ${node.name}`,
    userId: input.actorId,
    metadata: {
      edgeNodeId: input.edgeNodeId,
      credentialId: credential.credentialId,
      keyVersion: credential.keyVersion,
      secretFingerprint: fingerprint,
      encryptionKeyId: encrypted.keyId
    }
  });

  return {
    credentialId: credential.credentialId,
    keyVersion: credential.keyVersion,
    /** Shown once — never stored in plaintext. HMAC with this 32-byte secret (base64url). */
    secret: plaintextOnce,
    secretFingerprint: fingerprint,
    algorithm: "HMAC-SHA256",
    signingVersion: "GRIDFLEX-V1",
    signingNote:
      "Sign GRIDFLEX-V1 canonical message with HMAC-SHA256(deviceSecret). Server stores only vault ciphertext.",
    expiresAt: credential.expiresAt?.toISOString() ?? null
  };
};

/**
 * After the device successfully authenticates with key N+1, revoke overlapping N credentials.
 */
export const completeCredentialRotation = async (input: {
  edgeNodeId: string;
  activeCredentialId: string;
  actorId?: string;
}) => {
  const rotating = await prisma.deviceCredential.findMany({
    where: {
      edgeNodeId: input.edgeNodeId,
      status: DeviceCredentialStatus.rotating,
      credentialId: { not: input.activeCredentialId }
    }
  });

  if (rotating.length === 0) {
    return { revoked: 0 };
  }

  const now = new Date();
  await prisma.deviceCredential.updateMany({
    where: { id: { in: rotating.map((c) => c.id) } },
    data: {
      status: DeviceCredentialStatus.revoked,
      revokedAt: now
    }
  });

  await prisma.deviceProvisioningEvent.create({
    data: {
      edgeNodeId: input.edgeNodeId,
      action: "credential.rotation.complete",
      actorId: input.actorId ?? null,
      metadata: {
        activeCredentialId: input.activeCredentialId,
        revokedCredentialIds: rotating.map((c) => c.credentialId)
      } as Prisma.InputJsonValue
    }
  });

  await recordAuditLog({
    action: "device.credential.rotation.complete",
    entityType: "EdgeNode",
    entityId: input.edgeNodeId,
    message: `Completed credential rotation; revoked ${rotating.length} overlapping key(s)`,
    ...(input.actorId ? { userId: input.actorId } : {}),
    metadata: {
      activeCredentialId: input.activeCredentialId,
      revokedCount: rotating.length
    }
  });

  return { revoked: rotating.length };
};

export const revokeDeviceCredential = async (input: {
  credentialId: string;
  actorId: string;
}) => {
  const credential = await prisma.deviceCredential.findUnique({
    where: { credentialId: input.credentialId }
  });
  if (!credential) {
    throw new AppError("Device credential not found.", 404);
  }

  const updated = await prisma.deviceCredential.update({
    where: { id: credential.id },
    data: {
      status: DeviceCredentialStatus.revoked,
      revokedAt: new Date()
    }
  });

  await prisma.deviceProvisioningEvent.create({
    data: {
      edgeNodeId: credential.edgeNodeId,
      action: "credential.revoke",
      actorId: input.actorId,
      metadata: {
        credentialId: credential.credentialId,
        secretFingerprint: credential.secretFingerprint
      }
    }
  });

  await recordAuditLog({
    action: "device.credential.revoke",
    entityType: "DeviceCredential",
    entityId: credential.id,
    message: `Revoked device credential ${credential.credentialId}`,
    userId: input.actorId,
    metadata: {
      credentialId: credential.credentialId,
      secretFingerprint: credential.secretFingerprint
    }
  });

  return updated;
};

export const listDeviceCredentials = async (edgeNodeId: string) => {
  return prisma.deviceCredential.findMany({
    where: { edgeNodeId },
    orderBy: [{ keyVersion: "desc" }],
    select: {
      id: true,
      credentialId: true,
      keyVersion: true,
      status: true,
      algorithm: true,
      secretFingerprint: true,
      encryptionKeyId: true,
      createdAt: true,
      expiresAt: true,
      lastUsedAt: true,
      revokedAt: true,
      rotatedAt: true,
      lastSequenceNumber: true
      // Never select encryptedSecret / secretHash for API lists
    }
  });
};
