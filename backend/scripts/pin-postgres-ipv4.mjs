/**
 * Force Neon Postgres connections onto IPv4.
 *
 * The endpoint publishes A and AAAA records. Prisma connects to the AAAA
 * address and does not fall back, so IPv6-less hosts such as Render fail
 * immediately with P1001. Rewriting the URL to the A record skips DNS.
 * The endpoint id is passed separately because an IP address cannot be a
 * TLS server name, which is how Neon normally routes the connection.
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

export const neonEndpointId = (hostname) => {
  const label = hostname.split(".")[0]?.toLowerCase() ?? "";
  if (!label.startsWith("ep-")) return null;
  return label.endsWith("-pooler") ? label.slice(0, -"-pooler".length) : label;
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

export const connectionStringOnIpv4 = (connectionString, ipv4) => {
  const url = new URL(connectionString);
  const endpointId = neonEndpointId(url.hostname);
  url.hostname = ipv4;
  url.searchParams.delete("pgbouncer");
  if (!url.searchParams.has("sslmode")) {
    url.searchParams.set("sslmode", "require");
  }
  if (!url.searchParams.has("connect_timeout")) {
    url.searchParams.set("connect_timeout", "30");
  }
  const options = url.searchParams.get("options") ?? "";
  if (endpointId && !options.includes(`endpoint=${endpointId}`)) {
    url.searchParams.set(
      "options",
      options ? `${options} endpoint=${endpointId}` : `endpoint=${endpointId}`
    );
  }
  return url.toString();
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
    throw new Error(`Could not read ${HOSTS_PATH} (${message}).`);
  }

  let next = existing;
  for (const hostname of hostnames) {
    const addresses = await resolve4(hostname);
    const ipv4 = addresses[0];
    if (!ipv4) {
      throw new Error(`No IPv4 address for ${hostname}.`);
    }
    next = hostsFileWithPin(next, hostname, ipv4);
    console.error(`[pin-postgres-ipv4] Pinned ${hostname} to ${ipv4}.`);
  }

  try {
    writeFileSync(HOSTS_PATH, next);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not write ${HOSTS_PATH} (${message}).`);
  }
};

export const directIpv4ConnectionString = async (connectionString) => {
  const url = new URL(connectionString);
  if (isIP(url.hostname)) return connectionStringOnIpv4(connectionString, url.hostname);

  const addresses = await resolve4(url.hostname);
  const ipv4 = addresses[0];
  if (!ipv4) {
    throw new Error(`No IPv4 address for ${url.hostname}.`);
  }
  console.error(`[pin-postgres-ipv4] ${url.hostname} -> ${ipv4}`);
  return connectionStringOnIpv4(connectionString, ipv4);
};

export const useIpv4PostgresUrls = async () => {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const directUrl = process.env.DIRECT_URL?.trim() || databaseUrl;
  if (!directUrl) {
    throw new Error("DATABASE_URL is required.");
  }

  try {
    await pinPostgresHosts([databaseUrl, directUrl]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[pin-postgres-ipv4] Hosts pin skipped: ${message}`);
  }

  const ipv4Url = await directIpv4ConnectionString(directUrl);
  process.env.DATABASE_URL = ipv4Url;
  process.env.DIRECT_URL = ipv4Url;
  return ipv4Url;
};

const shellQuote = (value) => `'${value.replaceAll("'", `'\\''`)}'`;

const invokedDirectly = () => {
  const entry = process.argv[1];
  if (!entry) return false;
  return pathToFileURL(path.resolve(entry)).href === import.meta.url;
};

if (invokedDirectly()) {
  useIpv4PostgresUrls()
    .then(() => {
      if (process.argv.includes("--export")) {
        process.stdout.write(`export DATABASE_URL=${shellQuote(process.env.DATABASE_URL)}\n`);
        process.stdout.write(`export DIRECT_URL=${shellQuote(process.env.DIRECT_URL)}\n`);
      }
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[pin-postgres-ipv4] ${message}`);
      process.exit(1);
    });
}
