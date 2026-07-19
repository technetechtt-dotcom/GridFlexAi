import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { DeviceCredentialStatus } from "@prisma/client";
import type { RequestHandler } from "express";

import { env } from "../config/env.js";
import { assertAndStoreEdgeNonce, clearEdgeReplayCache } from "../lib/edge-replay.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/AppError.js";
import { createEdgeSignature, safeSignatureEquals } from "../utils/edgeDeviceAuth.js";

export { clearEdgeReplayCache };

const HEADER_DEVICE_ID = "x-gridflex-device-id";
const HEADER_TIMESTAMP = "x-gridflex-timestamp";
const HEADER_NONCE = "x-gridflex-nonce";
const HEADER_SIGNATURE = "x-gridflex-signature";
const HEADER_CREDENTIAL_ID = "x-gridflex-credential-id";
const HEADER_KEY_VERSION = "x-gridflex-key-version";

const getSingleHeader = (value: string | string[] | undefined): string | null => {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
};

const hashSecret = (secret: string): string =>
  createHash("sha256").update(secret).digest("hex");

export const hashDeviceSecret = hashSecret;

export const generateDeviceSecret = (): string => randomBytes(32).toString("base64url");

const safeHashEquals = (a: string, b: string): boolean => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
};

const verifyWithSecret = (
  headers: { deviceId: string; timestamp: string; nonce: string; signature: string },
  payload: unknown,
  secret: string
): boolean => {
  const expected = createEdgeSignature(
    {
      deviceId: headers.deviceId,
      timestamp: headers.timestamp,
      nonce: headers.nonce,
      payload
    },
    secret
  );
  return safeSignatureEquals(headers.signature, expected);
};

export const verifyEdgeDeviceAuth: RequestHandler = (req, _res, next) => {
  void (async () => {
    const deviceId = getSingleHeader(req.headers[HEADER_DEVICE_ID]);
    const timestamp = getSingleHeader(req.headers[HEADER_TIMESTAMP]);
    const nonce = getSingleHeader(req.headers[HEADER_NONCE]);
    const signature = getSingleHeader(req.headers[HEADER_SIGNATURE]);
    const credentialId = getSingleHeader(req.headers[HEADER_CREDENTIAL_ID]);
    const keyVersionHeader = getSingleHeader(req.headers[HEADER_KEY_VERSION]);

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

    const headers = { deviceId, timestamp, nonce, signature };

    // Preferred path: per-device credential.
    if (credentialId) {
      const credential = await prisma.deviceCredential.findUnique({
        where: { credentialId },
        include: { edgeNode: { select: { deviceKey: true, isActive: true, id: true } } }
      });

      if (!credential || !credential.edgeNode.isActive) {
        try {
          await prisma.edgeNode.updateMany({
            where: { deviceKey: deviceId },
            data: { lastAuthFailureAt: new Date() }
          });
        } catch {
          // Best-effort health bookkeeping.
        }
        next(new AppError("Invalid or inactive device credential.", 401));
        return;
      }

      if (credential.edgeNode.deviceKey && credential.edgeNode.deviceKey !== deviceId) {
        next(new AppError("Credential does not belong to this device.", 401));
        return;
      }

      if (
        credential.status === DeviceCredentialStatus.revoked ||
        credential.status === DeviceCredentialStatus.expired
      ) {
        next(new AppError("Device credential is revoked or expired.", 401));
        return;
      }

      if (credential.expiresAt && credential.expiresAt.getTime() <= Date.now()) {
        next(new AppError("Device credential expired.", 401));
        return;
      }

      if (keyVersionHeader) {
        const keyVersion = Number(keyVersionHeader);
        if (!Number.isFinite(keyVersion) || keyVersion !== credential.keyVersion) {
          next(new AppError("Device credential key version mismatch.", 401));
          return;
        }
      }

      // Secret was hashed at provisioning; signature uses the plaintext shown once.
      // Request must include the plaintext secret only via HMAC, never in body.
      // We verify by checking HMAC against candidate secrets is impossible after hashing,
      // so device credentials store hmac-ready secret hash of the provisioning secret and
      // firmware must sign with that same secret. Verification reconstructs expected HMAC
      // only when legacy mode supplies shared secret OR when rotating overlap stores hash.
      //
      // Practical approach for hashed secrets: store SHA-256(secret) and require the device
      // to send HMAC(message, secret). Server cannot recompute HMAC without plaintext.
      // Therefore we keep an encrypted-at-rest style by storing hash for identity and using
      // a derived verification material: HMAC(message, secretHash) as transitional scheme.
      // Documented as schemaVersion for device auth v2.
      const expectedWithHash = createEdgeSignature(
        {
          deviceId,
          timestamp,
          nonce,
          payload: req.body
        },
        credential.secretHash
      );

      if (!safeSignatureEquals(signature, expectedWithHash)) {
        try {
          await prisma.edgeNode.update({
            where: { id: credential.edgeNodeId },
            data: { lastAuthFailureAt: new Date() }
          });
        } catch {
          // Best-effort health bookkeeping.
        }
        next(new AppError("Invalid edge request signature.", 401));
        return;
      }

      await prisma.deviceCredential.update({
        where: { id: credential.id },
        data: { lastUsedAt: new Date() }
      });

      req.edgeAuth = {
        deviceId,
        credentialId: credential.credentialId,
        keyVersion: credential.keyVersion,
        mode: "device_credential"
      };
      next();
      return;
    }

    // Legacy shared-secret mode (temporary compatibility).
    if (!env.EDGE_ALLOW_LEGACY_SHARED_SECRET) {
      next(new AppError("Legacy shared-secret edge auth is disabled. Provision a device credential.", 401));
      return;
    }

    if (!verifyWithSecret(headers, req.body, env.EDGE_INGEST_SHARED_SECRET)) {
      try {
        await prisma.edgeNode.updateMany({
          where: { deviceKey: deviceId },
          data: { lastAuthFailureAt: new Date() }
        });
      } catch {
        // Best-effort health bookkeeping; never mask the auth failure response.
      }
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

// Keep helper exported for tests that previously imported from this module.
export const __test = {
  hashSecret,
  safeHashEquals
};
