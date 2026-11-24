/**
 * Pin Postgres hostnames to an IPv4 address in /etc/hosts.
 *
 * Neon endpoints publish both A and AAAA records. Prisma's schema engine
 * connects to the AAAA address and does not fall back. Render (and other
 * IPv6-less hosts) then fail immediately with P1001, even though the IPv4
 * address is reachable. Pinning the hostname keeps SNI intact and forces IPv4.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve4 } from "node:dns/promises";
import { isIP } from "node:net";
import path from "node:path";
import { pathToFileURL } from "node:url";

const HOSTS_PATH = "/etc/hosts";

export const hostnameOf = (connectionString) => {
  if (!connectionString) return null;
  try {
    const hostname = new URL(connectionString).hostname;
    if (!hostname || isIP(hostname)) return null;
    return hostname;
  } catch {
    return null;
  }
};

export const hostsFileWithPin = (existing, hostname, ipv4) => {
  const lines = existing.split("\n").filter((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return true;
    const names = trimmed.split(/\s+/).slice(1);
    return !names.includes(hostname);
  });
  while (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }
  lines.push(`${ipv4} ${hostname}`);
  return `${lines.join("\n")}\n`;
};

export const preferIpv4Resolver = () => {
  const current = process.env.RES_OPTIONS?.trim() ?? "";
  const parts = current.split(/\s+/).filter(Boolean);
  if (!parts.includes("no-aaaa")) {
    parts.push("no-aaaa");
  }
  process.env.RES_OPTIONS = parts.join(" ");
};

export const pinPostgresHosts = async (connectionStrings) => {
  if (process.platform !== "linux") return;

  preferIpv4Resolver();

  const hostnames = [...new Set(connectionStrings.map(hostnameOf).filter(Boolean))];
  if (hostnames.length === 0) return;

  let existing = "";
  try {
    existing = readFileSync(HOSTS_PATH, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not read ${HOSTS_PATH} (${message}). Prisma will fail with P1001 on IPv6-less hosts.`);
  }

  let next = existing;
  for (const hostname of hostnames) {
    let addresses;
    try {
      addresses = await resolve4(hostname);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`No IPv4 address for ${hostname}: ${message}`);
    }
    const ipv4 = addresses[0];
    if (!ipv4) {
      throw new Error(`No IPv4 address for ${hostname}.`);
    }
    next = hostsFileWithPin(next, hostname, ipv4);
    console.log(`[pin-postgres-ipv4] Pinned ${hostname} to ${ipv4}.`);
  }

  try {
    writeFileSync(HOSTS_PATH, next);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Could not write ${HOSTS_PATH} (${message}). Prisma migrate needs this IPv4 pin on Render.`
    );
  }
};

export const pinConfiguredPostgresHosts = () =>
  pinPostgresHosts([process.env.DATABASE_URL, process.env.DIRECT_URL]);

const invokedDirectly = () => {
  const entry = process.argv[1];
  if (!entry) return false;
  return pathToFileURL(path.resolve(entry)).href === import.meta.url;
};

if (invokedDirectly()) {
  pinConfiguredPostgresHosts().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[pin-postgres-ipv4] ${message}`);
    process.exit(1);
  });
}
