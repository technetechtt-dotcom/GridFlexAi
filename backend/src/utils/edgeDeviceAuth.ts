import crypto from "node:crypto";

type JsonLike = string | number | boolean | null | JsonLike[] | { [key: string]: JsonLike };

type SignatureInput = {
  deviceId: string;
  timestamp: string;
  nonce: string;
  payload: unknown;
};

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

const buildMessage = ({ deviceId, timestamp, nonce, payload }: SignatureInput): string => {
  return `${deviceId}.${timestamp}.${nonce}.${JSON.stringify(canonicalize(payload))}`;
};

export const createEdgeSignature = (input: SignatureInput, secret: string): string => {
  return crypto.createHmac("sha256", secret).update(buildMessage(input)).digest("hex");
};

export const safeSignatureEquals = (provided: string, expected: string): boolean => {
  if (!/^[0-9a-f]{64}$/i.test(provided) || !/^[0-9a-f]{64}$/i.test(expected)) {
    return false;
  }
  const providedBuffer = Buffer.from(provided, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
};
