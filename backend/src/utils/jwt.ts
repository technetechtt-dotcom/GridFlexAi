import jwt from "jsonwebtoken";
import type { Role } from "@prisma/client";

import { env } from "../config/env.js";
import { AppError } from "./AppError.js";
import { buildJwtKeyring, type JwtKeyring } from "./jwt-keyring.js";

export type { JwtKeyring } from "./jwt-keyring.js";
export { buildJwtKeyring } from "./jwt-keyring.js";

export type JwtPayload = {
  sub: string;
  email: string;
  name: string;
  role: Role;
  iat?: number;
  exp?: number;
};

let cachedKeyring: JwtKeyring | null = null;

export const getJwtKeyring = (): JwtKeyring => {
  if (!cachedKeyring) {
    cachedKeyring = buildJwtKeyring(env);
  }
  return cachedKeyring;
};

/** Test helper — clears memoized keyring after env mutations. */
export const resetJwtKeyringForTests = (): void => {
  cachedKeyring = null;
};

const signWithKeyring = (payload: JwtPayload, expiresIn: NonNullable<jwt.SignOptions["expiresIn"]>): string => {
  const keyring = getJwtKeyring();
  const secret = keyring.secretsByKid[keyring.activeKid];
  if (!secret) {
    throw new AppError("Active JWT signing key is missing.", 500);
  }
  const signOptions: jwt.SignOptions = {
    expiresIn,
    keyid: keyring.activeKid,
    algorithm: "HS256"
  };
  return jwt.sign(payload, secret, signOptions);
};

const verifyWithKeyring = (token: string): JwtPayload => {
  const keyring = getJwtKeyring();
  const decoded = jwt.decode(token, { complete: true });
  const kid =
    decoded && typeof decoded === "object" && "header" in decoded
      ? (decoded.header.kid as string | undefined)
      : undefined;

  const trySecrets: Array<{ kid: string; secret: string }> = [];
  if (kid && keyring.secretsByKid[kid]) {
    trySecrets.push({ kid, secret: keyring.secretsByKid[kid]! });
  }
  for (const [k, secret] of Object.entries(keyring.secretsByKid)) {
    if (k === kid) continue;
    trySecrets.push({ kid: k, secret });
  }

  let lastError: unknown;
  for (const entry of trySecrets) {
    try {
      return jwt.verify(token, entry.secret, { algorithms: ["HS256"] }) as JwtPayload;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }
  throw new AppError("Invalid or expired token.", 401);
};

export const signAccessToken = (payload: JwtPayload): string => {
  const expiresIn = env.JWT_ACCESS_EXPIRES_IN as NonNullable<jwt.SignOptions["expiresIn"]>;
  return signWithKeyring(payload, expiresIn);
};

export const verifyAccessToken = (token: string): JwtPayload => verifyWithKeyring(token);

export const signRefreshToken = (payload: JwtPayload): string => {
  const expiresIn = env.JWT_REFRESH_EXPIRES_IN as NonNullable<jwt.SignOptions["expiresIn"]>;
  return signWithKeyring(payload, expiresIn);
};

export const verifyRefreshToken = (token: string): JwtPayload => verifyWithKeyring(token);

/** Decode header kid without verifying (ops / rotation diagnostics). */
export const peekTokenKid = (token: string): string | undefined => {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || typeof decoded !== "object" || !("header" in decoded)) return undefined;
  return typeof decoded.header.kid === "string" ? decoded.header.kid : undefined;
};
