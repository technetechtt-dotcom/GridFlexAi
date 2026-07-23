import { randomBytes } from "node:crypto";

import { DeviceCredentialStatus } from "@prisma/client";
import type { RequestHandler } from "express";

import { env } from "../config/env.js";
import { assertAndStoreEdgeNonce, clearEdgeReplayCache } from "../lib/edge-replay.js";
import { prisma } from "../lib/prisma.js";
import { completeCredentialRotation } from "../services/device-credential.service.js";
import { getDeviceSecretVault } from "../services/device-secret-vault/index.js";
import { platformMetrics } from "../services/platform-metrics.service.js";
import { AppError } from "../utils/AppError.js";
import { logger } from "../utils/logger.js";
import {
  createGridFlexV1Signature,
  createLegacyEdgeSignature,
  hashRawBody,
  safeSignatureEquals,
  zeroBuffer
} from "../utils/edgeDeviceAuth.js";
import { parseSequenceNumber, SequenceNumberError, sequenceLessThan, sequencesEqual } from "../utils/sequence-number.js";

export { clearEdgeReplayCache };

const HEADER_DEVICE_ID = "x-gridflex-device-id";
const HEADER_TIMESTAMP = "x-gridflex-timestamp";
const HEADER_NONCE = "x-gridflex-nonce";
const HEADER_SIGNATURE = "x-gridflex-signature";
const HEADER_CREDENTIAL_ID = "x-gridflex-credential-id";
const HEADER_KEY_VERSION = "x-gridflex-key-version";
const HEADER_SEQUENCE = "x-gridflex-sequence-number";

const getSingleHeader = (value: string | string[] | undefined): string | null => {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
};

export const generateDeviceSecret = (): string => randomBytes(32).toString("base64url");

const recordAuthFailure = async (edgeNodeId: string | null, deviceId: string): Promise<void> => {
  try {
    if (edgeNodeId) {
      await prisma.edgeNode.update({
        where: { id: edgeNodeId },
        data: { lastAuthFailureAt: new Date() }
      });
      return;
    }
    await prisma.edgeNode.updateMany({
      where: { deviceKey: deviceId },
      data: { lastAuthFailureAt: new Date() }
    });
  } catch {
    // Best-effort health bookkeeping.
  }
};

export const verifyEdgeDeviceAuth: RequestHandler = (req, _res, next) => {
  void (async () => {
    const deviceId = getSingleHeader(req.headers[HEADER_DEVICE_ID]);
    const timestamp = getSingleHeader(req.headers[HEADER_TIMESTAMP]);
    const nonce = getSingleHeader(req.headers[HEADER_NONCE]);
    const signature = getSingleHeader(req.headers[HEADER_SIGNATURE]);
    const credentialId = getSingleHeader(req.headers[HEADER_CREDENTIAL_ID]);
    const keyVersionHeader = getSingleHeader(req.headers[HEADER_KEY_VERSION]);
    const sequenceHeader = getSingleHeader(req.headers[HEADER_SEQUENCE]);

    if (!deviceId || !timestamp || !nonce || !signature) {
      next(new AppError("Missing edge device authentication headers.", 401));
      return;
    }

    if (deviceId.length > 128 || nonce.length > 128) {
      next(new AppError("Invalid edge authentication header format.", 401));
      return;
    }

    const timestampMs = Number(timestamp);
    if (!Number.isFinite(timestampMs)) {
      next(new AppError("Invalid edge timestamp header.", 401));
      return;
    }

    const maxSkewMs = env.EDGE_INGEST_MAX_SKEW_SECONDS * 1000;
    const drift = Math.abs(Date.now() - timestampMs);
    if (drift > maxSkewMs) {
      next(new AppError("Edge request timestamp outside allowed clock skew.", 401));
      return;
    }

    try {
      await assertAndStoreEdgeNonce(deviceId, nonce);
    } catch (error) {
      next(error);
      return;
    }

    // Preferred path: vaulted per-device credential + GRIDFLEX-V1.
    // Both branches verify cryptographic signatures before accepting; credentialId
    // only selects which key material is used (not whether auth is enforced).
    // codeql[js/user-controlled-bypass]: auth scheme selection; HMAC verified on every path
    if (credentialId) {
      if (!sequenceHeader) {
        next(new AppError("Missing x-gridflex-sequence-number header.", 401));
        return;
      }
      let sequenceNumber: bigint;
      try {
        sequenceNumber = parseSequenceNumber(sequenceHeader);
      } catch (error) {
        next(
          new AppError(
            error instanceof SequenceNumberError ? error.message : "Invalid sequence number.",
            401
          )
        );
        return;
      }

      const credential = await prisma.deviceCredential.findUnique({
        where: { credentialId },
        include: { edgeNode: { select: { deviceKey: true, isActive: true, id: true } } }
      });

      if (!credential || !credential.edgeNode.isActive) {
        await recordAuthFailure(null, deviceId);
        logger.info("Edge auth failed: unknown or inactive credential.", {
          deviceId,
          credentialId,
          reason: "credential_missing_or_inactive"
        });
        next(new AppError("Invalid or inactive device credential.", 401));
        return;
      }

      if (credential.edgeNode.deviceKey && credential.edgeNode.deviceKey !== deviceId) {
        await recordAuthFailure(credential.edgeNodeId, deviceId);
        logger.info("Edge auth failed: device association mismatch.", {
          deviceId,
          credentialId,
          reason: "device_mismatch"
        });
        next(new AppError("Credential does not belong to this device.", 401));
        return;
      }

      if (
        credential.status === DeviceCredentialStatus.revoked ||
        credential.status === DeviceCredentialStatus.expired ||
        credential.status === DeviceCredentialStatus.pending
      ) {
        await recordAuthFailure(credential.edgeNodeId, deviceId);
        next(new AppError("Device credential is revoked, expired, or pending.", 401));
        return;
      }

      if (credential.expiresAt && credential.expiresAt.getTime() <= Date.now()) {
        await recordAuthFailure(credential.edgeNodeId, deviceId);
        next(new AppError("Device credential expired.", 401));
        return;
      }

      const keyVersion = keyVersionHeader ? Number(keyVersionHeader) : credential.keyVersion;
      if (!Number.isFinite(keyVersion) || keyVersion !== credential.keyVersion) {
        await recordAuthFailure(credential.edgeNodeId, deviceId);
        next(new AppError("Device credential key version mismatch.", 401));
        return;
      }

      if (!credential.encryptedSecret || !credential.encryptionKeyId) {
        await recordAuthFailure(credential.edgeNodeId, deviceId);
        logger.info("Edge auth failed: credential requires re-provisioning.", {
          deviceId,
          credentialId,
          reason: "legacy_secret_hash_only"
        });
        next(
          new AppError(
            "Device credential must be re-provisioned for vaulted secrets. Legacy secretHash credentials cannot verify GRIDFLEX-V1.",
            401
          )
        );
        return;
      }

      if (
        credential.lastSequenceNumber !== null &&
        credential.lastSequenceNumber !== undefined &&
        sequenceLessThan(sequenceNumber, credential.lastSequenceNumber)
      ) {
        await recordAuthFailure(credential.edgeNodeId, deviceId);
        logger.info("Edge auth failed: sequence regression.", {
          deviceId,
          credentialId,
          reason: "sequence_regression"
        });
        next(new AppError("Replayed or regressed sequence number.", 409));
        return;
      }

      const rawBody = req.rawBody;
      if (!rawBody || rawBody.length === 0) {
        next(new AppError("Raw request body required for signature verification.", 400));
        return;
      }
      const bodyHash = hashRawBody(rawBody);

      let plaintext: Buffer | null = null;
      try {
        const vault = getDeviceSecretVault();
        plaintext = await vault.decrypt({
          ciphertext: credential.encryptedSecret,
          keyId: credential.encryptionKeyId,
          ...(credential.encryptedDataKey
            ? { encryptedDataKey: credential.encryptedDataKey }
            : {})
        });

        const expected = createGridFlexV1Signature(
          {
            deviceId,
            credentialId: credential.credentialId,
            keyVersion: credential.keyVersion,
            timestamp,
            nonce,
            sequenceNumber,
            rawBody
          },
          plaintext
        );

        if (!safeSignatureEquals(signature, expected)) {
          await recordAuthFailure(credential.edgeNodeId, deviceId);
          logger.info("Edge auth failed: signature mismatch.", {
            deviceId,
            credentialId,
            reason: "bad_signature",
            event: "edge.auth.signature_failed"
          });
          platformMetrics.recordSignatureFailure();
          void import("../observability/alert-dispatcher.js").then(({ dispatchAlert }) =>
            dispatchAlert({
              alertId: "A-edge-signature-failed",
              severity: "critical",
              title: "Edge ingest signature failure",
              detail: `Invalid GRIDFLEX-V1 signature for device ${deviceId}`
            })
          );
          next(new AppError("Invalid edge request signature.", 401));
          return;
        }
      } catch (error) {
        if (error instanceof AppError) {
          next(error);
          return;
        }
        await recordAuthFailure(credential.edgeNodeId, deviceId);
        logger.info("Edge auth failed: vault decrypt or verify error.", {
          deviceId,
          credentialId,
          reason: "vault_or_verify_error"
        });
        next(new AppError("Invalid edge request signature.", 401));
        return;
      } finally {
        if (plaintext) {
          zeroBuffer(plaintext);
        }
      }

      // Atomic watermark advance bound to body hash (CAS on lastSequenceNumber).
      const advanced = await prisma.deviceCredential.updateMany({
        where: {
          id: credential.id,
          OR: [{ lastSequenceNumber: null }, { lastSequenceNumber: { lt: sequenceNumber } }]
        },
        data: {
          lastUsedAt: new Date(),
          lastSequenceNumber: sequenceNumber,
          lastAcceptedBodyHash: bodyHash
        }
      });

      let idempotentReplay = false;
      if (advanced.count === 0) {
        const current = await prisma.deviceCredential.findUnique({ where: { id: credential.id } });
        if (!current) {
          next(new AppError("Device credential disappeared during sequence advance.", 409));
          return;
        }
        if (sequencesEqual(current.lastSequenceNumber, sequenceNumber)) {
          if (current.lastAcceptedBodyHash && current.lastAcceptedBodyHash !== bodyHash) {
            await recordAuthFailure(credential.edgeNodeId, deviceId);
            platformMetrics.recordReplayAttempt();
            next(new AppError("Sequence reused with a different body hash.", 409));
            return;
          }
          await prisma.deviceCredential.update({
            where: { id: credential.id },
            data: {
              lastUsedAt: new Date(),
              ...(current.lastAcceptedBodyHash ? {} : { lastAcceptedBodyHash: bodyHash })
            }
          });
          idempotentReplay = true;
        } else if (
          current.lastSequenceNumber !== null &&
          current.lastSequenceNumber !== undefined &&
          sequenceLessThan(sequenceNumber, current.lastSequenceNumber)
        ) {
          await recordAuthFailure(credential.edgeNodeId, deviceId);
          next(new AppError("Replayed or regressed sequence number.", 409));
          return;
        } else {
          await recordAuthFailure(credential.edgeNodeId, deviceId);
          next(new AppError("Sequence conflict; retry with the next sequence number.", 409));
          return;
        }
      }

      // Overlap window: first successful use of the new active key completes rotation.
      if (credential.status === DeviceCredentialStatus.active && !idempotentReplay) {
        try {
          await completeCredentialRotation({
            edgeNodeId: credential.edgeNodeId,
            activeCredentialId: credential.credentialId
          });
        } catch {
          // Rotation bookkeeping must not fail the ingest.
        }
      }

      req.edgeAuth = {
        deviceId,
        credentialId: credential.credentialId,
        keyVersion: credential.keyVersion,
        sequenceNumber,
        idempotentReplay,
        mode: "device_credential"
      };
      next();
      return;
    }

    // Legacy shared-secret mode (temporary compatibility — hex HMAC over canonical JSON).
    if (!env.EDGE_ALLOW_LEGACY_SHARED_SECRET) {
      next(new AppError("Legacy shared-secret edge auth is disabled. Provision a device credential.", 401));
      return;
    }

    const expectedLegacy = createLegacyEdgeSignature(
      {
        deviceId,
        timestamp,
        nonce,
        payload: req.body
      },
      env.EDGE_INGEST_SHARED_SECRET
    );

    if (!safeSignatureEquals(signature.toLowerCase(), expectedLegacy.toLowerCase())) {
      await recordAuthFailure(null, deviceId);
      next(new AppError("Invalid edge request signature.", 401));
      return;
    }

    req.edgeAuth = {
      deviceId,
      mode: "legacy_shared_secret"
    };
    next();
  })().catch(next);
};

export const __test = {
  generateDeviceSecret
};
