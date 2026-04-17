import fs from "node:fs/promises";
import path from "node:path";

const stagingFile = process.env.STAGING_ENV_KEYS_FILE ?? "env-keys/staging.env.keys";
const productionFile = process.env.PRODUCTION_ENV_KEYS_FILE ?? "env-keys/production.env.keys";
const stagingPath = path.resolve(stagingFile);
const productionPath = path.resolve(productionFile);

const parseKeys = (raw) => {
  const keys = new Set();
  const lines = raw.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const key = trimmed.includes("=") ? trimmed.slice(0, trimmed.indexOf("=")).trim() : trimmed;
    if (!key) continue;
    keys.add(key);
  }
  return keys;
};

const toSortedArray = (set) => Array.from(set).sort((a, b) => a.localeCompare(b));

const diffSet = (source, target) => {
  const diff = new Set();
  for (const key of source) {
    if (!target.has(key)) {
      diff.add(key);
    }
  }
  return diff;
};

const main = async () => {
  const [stagingRaw, productionRaw] = await Promise.all([
    fs.readFile(stagingPath, "utf8"),
    fs.readFile(productionPath, "utf8")
  ]);

  const stagingKeys = parseKeys(stagingRaw);
  const productionKeys = parseKeys(productionRaw);

  const missingInProduction = diffSet(stagingKeys, productionKeys);
  const missingInStaging = diffSet(productionKeys, stagingKeys);

  // eslint-disable-next-line no-console
  console.log(`Staging keys: ${stagingKeys.size}`);
  // eslint-disable-next-line no-console
  console.log(`Production keys: ${productionKeys.size}`);

  if (missingInProduction.size === 0 && missingInStaging.size === 0) {
    // eslint-disable-next-line no-console
    console.log("Environment key parity check: PASS");
    return;
  }

  // eslint-disable-next-line no-console
  console.log("Environment key parity check: FAIL");
  if (missingInProduction.size > 0) {
    // eslint-disable-next-line no-console
    console.log("Missing in production:");
    for (const key of toSortedArray(missingInProduction)) {
      // eslint-disable-next-line no-console
      console.log(`- ${key}`);
    }
  }
  if (missingInStaging.size > 0) {
    // eslint-disable-next-line no-console
    console.log("Missing in staging:");
    for (const key of toSortedArray(missingInStaging)) {
      // eslint-disable-next-line no-console
      console.log(`- ${key}`);
    }
  }

  process.exitCode = 1;
};

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
