/**
 * Render staging boot: derive DIRECT_URL from DATABASE_URL (Neon pooler → direct),
 * then migrate, vault-verify, and start. An explicit DIRECT_URL takes precedence.
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

process.env.DIRECT_URL = process.env.DIRECT_URL?.trim() || deriveDirectUrl(databaseUrl);

// This entry point builds from source. Registry identity belongs exclusively to
// the signed-image entry point, never to a stale dashboard value.
delete process.env.RELEASE_IMAGE_DIGEST;
process.env.REQUIRE_RELEASE_IDENTITY = "false";
if (process.env.RENDER_GIT_COMMIT?.trim()) {
  process.env.RELEASE_GIT_SHA = process.env.RENDER_GIT_COMMIT.trim();
} else {
  delete process.env.RELEASE_GIT_SHA;
}

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
