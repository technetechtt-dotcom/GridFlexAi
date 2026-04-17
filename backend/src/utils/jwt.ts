import jwt from "jsonwebtoken";
import type { Role } from "@prisma/client";

import { env } from "../config/env.js";

export type JwtPayload = {
  sub: string;
  email: string;
  name: string;
  role: Role;
  iat?: number;
  exp?: number;
};

export const signAccessToken = (payload: JwtPayload): string => {
  const signOptions: jwt.SignOptions = {};
  const expiresIn = env.JWT_ACCESS_EXPIRES_IN as NonNullable<jwt.SignOptions["expiresIn"]>;
  signOptions.expiresIn = expiresIn;

  return jwt.sign(payload, env.JWT_SECRET, signOptions);
};

export const verifyAccessToken = (token: string): JwtPayload => {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
};

export const signRefreshToken = (payload: JwtPayload): string => {
  const signOptions: jwt.SignOptions = {};
  const expiresIn = env.JWT_REFRESH_EXPIRES_IN as NonNullable<jwt.SignOptions["expiresIn"]>;
  signOptions.expiresIn = expiresIn;

  return jwt.sign(payload, env.JWT_SECRET, signOptions);
};

export const verifyRefreshToken = (token: string): JwtPayload => {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
};
