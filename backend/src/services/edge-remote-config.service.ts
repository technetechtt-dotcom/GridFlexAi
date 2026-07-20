import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify } from "node:crypto";

import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/AppError.js";

/** Canonical remote-config fields signed by the server (never includes HMAC device secrets). */
export type EdgeRemoteConfigPayload = {
  configurationVersion: string;
  pollingIntervalMs: number;
  serverEndpoint: string;
  enabledTelemetryKeys: string[];
  approvedFirmwareMinimum: string;
  issuedAt: string;
  expiresAt: string;
};

const POLL_MIN_MS = 5_000;
const POLL_MAX_MS = 3_600_000;

export const canonicalizeRemoteConfig = (payload: EdgeRemoteConfigPayload): string =>
  JSON.stringify({
    approvedFirmwareMinimum: payload.approvedFirmwareMinimum,
    configurationVersion: payload.configurationVersion,
    enabledTelemetryKeys: [...payload.enabledTelemetryKeys].sort(),
    expiresAt: payload.expiresAt,
    issuedAt: payload.issuedAt,
    pollingIntervalMs: payload.pollingIntervalMs,
    serverEndpoint: payload.serverEndpoint
  });

export const validateRemoteConfigRanges = (payload: EdgeRemoteConfigPayload): void => {
  if (
    !Number.isFinite(payload.pollingIntervalMs) ||
    payload.pollingIntervalMs < POLL_MIN_MS ||
    payload.pollingIntervalMs > POLL_MAX_MS
  ) {
    throw new AppError(`pollingIntervalMs must be between ${POLL_MIN_MS} and ${POLL_MAX_MS}.`, 400);
  }
  if (!payload.serverEndpoint.startsWith("https://") && !payload.serverEndpoint.startsWith("http://localhost")) {
    throw new AppError("serverEndpoint must be https (or http://localhost for lab).", 400);
  }
  if (!payload.configurationVersion.trim()) {
    throw new AppError("configurationVersion is required.", 400);
  }
  if (!payload.approvedFirmwareMinimum.trim()) {
    throw new AppError("approvedFirmwareMinimum is required.", 400);
  }
  const issued = Date.parse(payload.issuedAt);
  const expires = Date.parse(payload.expiresAt);
  if (!Number.isFinite(issued) || !Number.isFinite(expires) || expires <= issued) {
    throw new AppError("expiresAt must be after issuedAt.", 400);
  }
  if (expires <= Date.now()) {
    throw new AppError("Remote configuration is already expired.", 400);
  }
};

export const generateEdgeConfigSigningKeyPair = () => generateKeyPairSync("ed25519");

const resolvePrivateKey = () => {
  const pem = (process.env.EDGE_CONFIG_SIGNING_PRIVATE_KEY_PEM ?? env.EDGE_CONFIG_SIGNING_PRIVATE_KEY_PEM)?.trim();
  if (!pem) {
    throw new AppError("EDGE_CONFIG_SIGNING_PRIVATE_KEY_PEM is not configured.", 503);
  }
  return createPrivateKey(pem);
};

export const resolvePublicKeyPem = (): string => {
  const pem = (process.env.EDGE_CONFIG_SIGNING_PUBLIC_KEY_PEM ?? env.EDGE_CONFIG_SIGNING_PUBLIC_KEY_PEM)?.trim();
  if (pem) return pem;
  const privatePem = (process.env.EDGE_CONFIG_SIGNING_PRIVATE_KEY_PEM ?? env.EDGE_CONFIG_SIGNING_PRIVATE_KEY_PEM)?.trim();
  if (!privatePem) {
    throw new AppError("EDGE_CONFIG_SIGNING_PUBLIC_KEY_PEM is not configured.", 503);
  }
  const priv = createPrivateKey(privatePem);
  return createPublicKey(priv).export({ type: "spki", format: "pem" }).toString();
};

export const signRemoteConfigPayload = (canonicalJson: string): string => {
  const signature = sign(null, Buffer.from(canonicalJson, "utf8"), resolvePrivateKey());
  return signature.toString("base64url");
};

export const verifyRemoteConfigSignature = (
  canonicalJson: string,
  signatureBase64Url: string,
  publicKeyPem?: string
): boolean => {
  const key = createPublicKey(publicKeyPem ?? resolvePublicKeyPem());
  try {
    return verify(null, Buffer.from(canonicalJson, "utf8"), key, Buffer.from(signatureBase64Url, "base64url"));
  } catch {
    return false;
  }
};

export const publishRemoteConfig = async (
  input: EdgeRemoteConfigPayload,
  actorId?: string
) => {
  validateRemoteConfigRanges(input);
  const payloadJson = canonicalizeRemoteConfig(input);
  const signature = signRemoteConfigPayload(payloadJson);

  await prisma.edgeRemoteConfig.updateMany({
    where: { isActive: true },
    data: { isActive: false }
  });

  const row = await prisma.edgeRemoteConfig.create({
    data: {
      configVersion: input.configurationVersion,
      pollingIntervalMs: input.pollingIntervalMs,
      serverEndpoint: input.serverEndpoint,
      enabledTelemetryKeys: input.enabledTelemetryKeys,
      approvedFirmwareMinimum: input.approvedFirmwareMinimum,
      issuedAt: new Date(input.issuedAt),
      expiresAt: new Date(input.expiresAt),
      payloadJson,
      signature,
      isActive: true,
      ...(actorId ? { createdById: actorId } : {})
    }
  });

  return {
    ...input,
    signature,
    payloadJson,
    id: row.id
  };
};

export const getActiveRemoteConfigForDevice = async () => {
  const row = await prisma.edgeRemoteConfig.findFirst({
    where: { isActive: true, expiresAt: { gt: new Date() } },
    orderBy: { issuedAt: "desc" }
  });
  if (!row) {
    throw new AppError("No active remote configuration.", 404);
  }
  if (!verifyRemoteConfigSignature(row.payloadJson, row.signature)) {
    throw new AppError("Stored remote configuration signature is invalid.", 500);
  }
  return {
    configurationVersion: row.configVersion,
    pollingIntervalMs: row.pollingIntervalMs,
    serverEndpoint: row.serverEndpoint,
    enabledTelemetryKeys: row.enabledTelemetryKeys as string[],
    approvedFirmwareMinimum: row.approvedFirmwareMinimum,
    issuedAt: row.issuedAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    signature: row.signature,
    payloadJson: row.payloadJson
  };
};

export const hashPayload = (raw: string | Buffer): string =>
  createHash("sha256").update(raw).digest("hex");
