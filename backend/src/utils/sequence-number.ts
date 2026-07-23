/**
 * Edge ingest sequence numbers are BIGINT end-to-end.
 * Prefer decimal strings at API boundaries; bigint in process/DB.
 */

/** PostgreSQL BIGINT signed max (2^63 - 1). */
export const SEQUENCE_MAX = 9223372036854775807n;
export const SEQUENCE_INT4_MAX = 2147483647n;

export class SequenceNumberError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SequenceNumberError";
  }
}

export const parseSequenceNumber = (raw: string | number | bigint): bigint => {
  if (typeof raw === "bigint") {
    if (raw < 0n || raw > SEQUENCE_MAX) {
      throw new SequenceNumberError("Sequence number out of BIGINT range.");
    }
    return raw;
  }

  if (typeof raw === "number") {
    if (!Number.isInteger(raw) || raw < 0 || raw > Number.MAX_SAFE_INTEGER) {
      throw new SequenceNumberError("Invalid sequence number.");
    }
    return BigInt(raw);
  }

  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new SequenceNumberError("Invalid sequence number.");
  }
  // Reject leading zeros except "0"
  if (trimmed.length > 1 && trimmed.startsWith("0")) {
    throw new SequenceNumberError("Invalid sequence number.");
  }
  let value: bigint;
  try {
    value = BigInt(trimmed);
  } catch {
    throw new SequenceNumberError("Invalid sequence number.");
  }
  if (value < 0n || value > SEQUENCE_MAX) {
    throw new SequenceNumberError("Sequence number out of BIGINT range.");
  }
  return value;
};

/** Canonical signing / headers always use the decimal string form. */
export const sequenceToCanonicalString = (value: bigint | number | string): string =>
  parseSequenceNumber(value).toString(10);

/**
 * JSON-safe encoding: number when within MAX_SAFE_INTEGER, else decimal string.
 */
export const sequenceToJson = (value: bigint | number | null | undefined): number | string | null => {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "bigint" ? value : parseSequenceNumber(value);
  if (parsed <= BigInt(Number.MAX_SAFE_INTEGER)) {
    return Number(parsed);
  }
  return parsed.toString(10);
};

export const sequencesEqual = (
  a: bigint | number | string | null | undefined,
  b: bigint | number | string | null | undefined
): boolean => {
  if (a === null || a === undefined || b === null || b === undefined) {
    return a === b;
  }
  return parseSequenceNumber(a) === parseSequenceNumber(b);
};

export const sequenceLessThan = (
  a: bigint | number | string,
  b: bigint | number | string
): boolean => parseSequenceNumber(a) < parseSequenceNumber(b);
