/**
 * JWT HMAC keyring (kid → secret) used for overlapping key rotation.
 * Kept free of `env` imports so production safety checks can validate config.
 */

export type JwtKeyring = {
  /** kid used when signing new tokens */
  activeKid: string;
  /** kid → HMAC secret (overlapping keys during rotation) */
  secretsByKid: Record<string, string>;
};

export type JwtKeyringConfig = {
  JWT_SECRET: string;
  JWT_ACTIVE_KID?: string | undefined;
  JWT_SECRETS_JSON?: string | undefined;
  JWT_PREVIOUS_SECRET?: string | undefined;
  JWT_PREVIOUS_KID?: string | undefined;
};

/**
 * Preferred (rotation-safe):
 *   JWT_ACTIVE_KID=v2
 *   JWT_SECRETS_JSON={"v1":"...","v2":"..."}
 *
 * Legacy single-secret (auto kid "legacy" or JWT_ACTIVE_KID):
 *   JWT_SECRET=...
 *
 * Optional previous secret without JSON map:
 *   JWT_PREVIOUS_SECRET=...
 *   JWT_PREVIOUS_KID=v1
 */
export const buildJwtKeyring = (config: JwtKeyringConfig): JwtKeyring => {
  const secretsByKid: Record<string, string> = {};

  if (config.JWT_SECRETS_JSON?.trim()) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(config.JWT_SECRETS_JSON);
    } catch {
      throw new Error("JWT_SECRETS_JSON must be valid JSON object of kid→secret.");
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("JWT_SECRETS_JSON must be an object of kid→secret.");
    }
    for (const [kid, secret] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof secret !== "string" || secret.length < 16) {
        throw new Error(`JWT secret for kid "${kid}" must be a string of at least 16 characters.`);
      }
      secretsByKid[kid] = secret;
    }
  }

  const legacyKid = config.JWT_ACTIVE_KID?.trim() || "legacy";
  if (!secretsByKid[legacyKid]) {
    secretsByKid[legacyKid] = config.JWT_SECRET;
  }

  if (config.JWT_PREVIOUS_SECRET?.trim()) {
    const prevKid = config.JWT_PREVIOUS_KID?.trim() || "previous";
    secretsByKid[prevKid] = config.JWT_PREVIOUS_SECRET.trim();
  }

  const activeKid = config.JWT_ACTIVE_KID?.trim() || legacyKid;
  if (!secretsByKid[activeKid]) {
    throw new Error(`JWT_ACTIVE_KID "${activeKid}" is not present in the keyring.`);
  }

  return { activeKid, secretsByKid };
};
