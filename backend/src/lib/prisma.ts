import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

function adapterFor(connectionString: string): PrismaPg {
  let hostname = "";
  try {
    hostname = new URL(connectionString).hostname;
  } catch {
    hostname = "";
  }
  const ipv4 = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);
  return new PrismaPg({
    connectionString,
    ...(ipv4 ? { ssl: { rejectUnauthorized: false } } : {})
  });
}

export function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }
  return new PrismaClient({
    adapter: adapterFor(connectionString),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
  });
}

export const prisma = createPrismaClient();
