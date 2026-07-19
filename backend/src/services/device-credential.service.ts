import { DeviceCredentialStatus, Prisma } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";

import { prisma } from "../lib/prisma.js";
import { recordAuditLog } from "./audit-log.service.js";
import { AppError } from "../utils/AppError.js";

const hashSecret = (secret: string): string => createHash("sha256").update(secret).digest("hex");

export const provisionDeviceCredential = async (input: {
  edgeNodeId: string;
  actorId: string;
  expiresAt?: Date;
}) => {
  const node = await prisma.edgeNode.findUnique({ where: { id: input.edgeNodeId } });
  if (!node) {
    throw new AppError("Edge node not found.", 404);
  }

  const plaintextSecret = randomBytes(32).toString("base64url");
  const credentialId = `cred_${randomBytes(12).toString("hex")}`;
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
        secretHash: hashSecret(plaintextSecret),
        keyVersion: (latest?.keyVersion ?? 0) + 1,
        status: DeviceCredentialStatus.active,
        expiresAt: input.expiresAt ?? null
      }
    });
  });

  await prisma.deviceProvisioningEvent.create({
    data: {
      edgeNodeId: input.edgeNodeId,
      action: "credential.provision",
      actorId: input.actorId,
      metadata: {
        credentialId: credential.credentialId,
        keyVersion: credential.keyVersion
      } as Prisma.InputJsonValue
    }
  });

  await recordAuditLog({
    action: "device.credential.provision",
    entityType: "DeviceCredential",
    entityId: credential.id,
    message: `Provisioned device credential for node ${node.name}`,
    userId: input.actorId,
    metadata: {
      edgeNodeId: input.edgeNodeId,
      credentialId: credential.credentialId,
      keyVersion: credential.keyVersion
    }
  });

  return {
    credentialId: credential.credentialId,
    keyVersion: credential.keyVersion,
    /** Shown once — never stored in plaintext. Sign requests with HMAC using SHA-256(secret) as key material. */
    secret: plaintextSecret,
    secretHashAlgorithm: "sha256",
    signingNote:
      "Device must HMAC-sign with secretHash = SHA-256(secret). Server verifies HMAC(message, secretHash).",
    expiresAt: credential.expiresAt?.toISOString() ?? null
  };
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
      metadata: { credentialId: credential.credentialId }
    }
  });

  await recordAuditLog({
    action: "device.credential.revoke",
    entityType: "DeviceCredential",
    entityId: credential.id,
    message: `Revoked device credential ${credential.credentialId}`,
    userId: input.actorId
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
      createdAt: true,
      expiresAt: true,
      lastUsedAt: true,
      revokedAt: true,
      rotatedAt: true
    }
  });
};
