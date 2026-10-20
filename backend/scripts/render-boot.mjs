/**
 * Render staging boot: derive DIRECT_URL from DATABASE_URL (Neon pooler → direct),
 * then migrate, vault-verify, and start. Ignores a stale dashboard DIRECT_URL so
 * operators only need to keep DATABASE_URL current.
 */
import { spawnSync } from "node:child_process";
import { URL } from "node:url";

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

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error("[render-boot] DATABASE_URL is required.");
  process.exit(1);
}

const derived = deriveDirectUrl(databaseUrl);
const previous = process.env.DIRECT_URL?.trim();
if (previous && previous !== derived) {
  console.warn(
    "[render-boot] Overriding stale DIRECT_URL for migrate (host differed from DATABASE_URL)."
  );
}
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

run("npx", ["prisma", "migrate", "deploy"]);
run("npm", ["run", "vault:verify"]);
run("npm", ["run", "start"]);
