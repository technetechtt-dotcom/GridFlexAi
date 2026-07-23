import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { sequenceToCanonicalString } from "./sequence-number.js";

export const GRIDFLEX_SIGNING_VERSION = "GRIDFLEX-V1" as const;

export type GridFlexV1SignInput = {
  deviceId: string;
  credentialId: string;
  keyVersion: number;
  timestamp: string;
  nonce: string;
  /** Decimal string or bigint — never float. */
  sequenceNumber: number | bigint | string;
  /** Exact raw HTTP body bytes (UTF-8). Do not re-serialize JSON objects. */
  rawBody: Buffer | string;
};

export type LegacySignInput = {
  deviceId: string;
  timestamp: string;
  nonce: string;
  payload: unknown;
};

type JsonLike = string | number | boolean | null | JsonLike[] | { [key: string]: JsonLike };

const canonicalize = (value: unknown): JsonLike => {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return entries.reduce<Record<string, JsonLike>>((acc, [key, nestedValue]) => {
      acc[key] = canonicalize(nestedValue);
      return acc;
    }, {});
  }
  return String(value);
};

/** SHA-256 hex of the exact request body bytes. */
export const hashRawBody = (rawBody: Buffer | string): string => {
  const buf = typeof rawBody === "string" ? Buffer.from(rawBody, "utf8") : rawBody;
  return createHash("sha256").update(buf).digest("hex");
};

/**
 * Canonical GRIDFLEX-V1 message (newline-separated UTF-8).
 * Field order is fixed — do not sign re-serialized JSON objects.
 */
export const buildGridFlexV1Canonical = (input: GridFlexV1SignInput): string => {
  const bodyHash = hashRawBody(input.rawBody);
  return [
    GRIDFLEX_SIGNING_VERSION,
    input.deviceId,
    input.credentialId,
    String(input.keyVersion),
    input.timestamp,
    input.nonce,
    sequenceToCanonicalString(input.sequenceNumber),
    bodyHash
  ].join("\n");
};

/**
 * HMAC-SHA256 over GRIDFLEX-V1 canonical string.
 * `deviceSecret` is the 256-bit plaintext (Buffer) or its base64url encoding.
 * Returns base64url digest.
 */
export const decodeDeviceSecret = (deviceSecret: Buffer | string): Buffer => {
  if (typeof deviceSecret !== "string") {
    return deviceSecret;
  }
  const asB64 = Buffer.from(deviceSecret, "base64url");
  if (asB64.length === 32) {
    return asB64;
  }
  return Buffer.from(deviceSecret, "utf8");
};

export const createGridFlexV1Signature = (
  input: GridFlexV1SignInput,
  deviceSecret: Buffer | string
): string => {
  const key = decodeDeviceSecret(deviceSecret);
  const canonical = buildGridFlexV1Canonical(input);
  return createHmac("sha256", key).update(canonical, "utf8").digest("base64url");
};

export const fingerprintDeviceSecret = (secret: Buffer): string =>
  createHash("sha256").update(secret).digest("hex");

/**
 * Timing-safe compare for base64url (or hex) signatures of equal length encodings.
 */
export const safeSignatureEquals = (provided: string, expected: string): boolean => {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
};

/** @deprecated Legacy shared-secret path — signs canonicalize(JSON) with hex HMAC. */
export const createLegacyEdgeSignature = (input: LegacySignInput, secret: string): string => {
  const message = `${input.deviceId}.${input.timestamp}.${input.nonce}.${JSON.stringify(canonicalize(input.payload))}`;
  return createHmac("sha256", secret).update(message).digest("hex");
};

/**
 * @deprecated Prefer createGridFlexV1Signature. Kept for legacy shared-secret ingest.
 */
export const createEdgeSignature = createLegacyEdgeSignature;

export const zeroBuffer = (buf: Buffer): void => {
  buf.fill(0);
};
