/**
 * Render staging boot: derive DIRECT_URL from DATABASE_URL (Neon pooler → direct),
 * pin those hosts to IPv4, then migrate, vault-verify, and start.
 * Ignores a stale dashboard DIRECT_URL so operators only need to keep DATABASE_URL current.
 */
import { spawnSync } from "node:child_process";
import { URL } from "node:url";
import { pinConfiguredPostgresHosts } from "./pin-postgres-ipv4.mjs";

const deriveDirectUrl = (databaseUrl) => {
  const url = new URL(databaseUrl);
  const host = url.hostname.toLowerCase();

  if (host.endsWith("-pooler.neon.tech") || (host.includes("-pooler.") && host.endsWith(".neon.tech"))) {
    url.hostname = url.hostname.replace("-pooler", "");
    return url.toString();
  }
  if (host.includes("-pooler.")) {
    url.hostname = url.hostname.replace("-pooler", "");
    return url.toString();
  }
  return databaseUrl;
};

const withNeonConnectOptions = (connectionString) => {
  let url;
  try {
    url = new URL(connectionString);
  } catch {
    return connectionString;
  }
  if (!url.hostname.toLowerCase().endsWith(".neon.tech")) return connectionString;

  let changed = false;
  if (!url.searchParams.has("sslmode")) {
    url.searchParams.set("sslmode", "require");
    changed = true;
  }
  if (!url.searchParams.has("connect_timeout")) {
    url.searchParams.set("connect_timeout", "30");
    changed = true;
  }
  return changed ? url.toString() : connectionString;
};

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error("[render-boot] DATABASE_URL is required.");
  process.exit(1);
}

const derived = withNeonConnectOptions(deriveDirectUrl(databaseUrl));
const previous = process.env.DIRECT_URL?.trim();
const hostnameOf = (connectionString) => {
  try {
    return new URL(connectionString).hostname;
  } catch {
    return connectionString;
  }
};
if (previous && hostnameOf(previous) !== hostnameOf(derived)) {
  console.warn(
    "[render-boot] Overriding stale DIRECT_URL for migrate (host differed from DATABASE_URL)."
  );
}
process.env.DATABASE_URL = withNeonConnectOptions(databaseUrl);
process.env.DIRECT_URL = derived;

const run = (command, args) => {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32"
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

const main = async () => {
  await pinConfiguredPostgresHosts();
  run("npx", ["prisma", "migrate", "deploy"]);
  run("npm", ["run", "vault:verify"]);
  run("npm", ["run", "start"]);
};

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[render-boot] ${message}`);
  process.exit(1);
});
