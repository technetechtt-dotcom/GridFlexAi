import bcrypt from "bcryptjs";

import { BCRYPT_ROUNDS } from "../config/constants.js";

export const hashPassword = async (value: string): Promise<string> => {
  return bcrypt.hash(value, BCRYPT_ROUNDS);
};

export const comparePassword = async (plainText: string, hashed: string): Promise<boolean> => {
  return bcrypt.compare(plainText, hashed);
};
