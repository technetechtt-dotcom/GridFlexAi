/**
 * Redact secrets and high-sensitivity fields before structured logging.
 * Never log tokens, passwords, full signatures, or raw vault material.
 */

const SENSITIVE_KEY =
  /^(authorization|cookie|password|passwd|secret|token|api[_-]?key|private[_-]?key|signature|rawbody|encryptedsecret|devicesecret|jwt|refresh|hmac)$/i;

const SENSITIVE_SUBSTRING =
  /(bearer\s+[a-z0-9\-._~+/]+=*|eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+|sk-[a-zA-Z0-9]{10,}|-----BEGIN[^-]+PRIVATE KEY-----)/gi;

export const redactString = (value: string): string => value.replace(SENSITIVE_SUBSTRING, "[REDACTED]");

export const redactValue = (value: unknown, depth = 0): unknown => {
  if (depth > 6) return "[TRUNCATED]";
  if (value == null) return value;
  if (typeof value === "string") return redactString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map((item) => redactValue(item, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY.test(key)) {
        out[key] = "[REDACTED]";
      } else {
        out[key] = redactValue(child, depth + 1);
      }
    }
    return out;
  }
  return String(value);
};

export const redactMeta = (meta?: Record<string, unknown>): Record<string, unknown> | undefined => {
  if (!meta) return undefined;
  return redactValue(meta) as Record<string, unknown>;
};
