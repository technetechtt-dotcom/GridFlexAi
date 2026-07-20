/**
 * Enhanced staging vs production environment key / policy parity.
 * Compares key names (never secret values) and flags unsafe production settings
 * when PRODUCTION_ENV_FILE is provided (optional values check for booleans only).
 */

import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

const stagingFile = process.env.STAGING_ENV_KEYS_FILE ?? "env-keys/staging.env.keys";
const productionFile = process.env.PRODUCTION_ENV_KEYS_FILE ?? "env-keys/production.env.keys";
const productionEnvFile = process.env.PRODUCTION_ENV_FILE; // optional, real values — not committed
const reportPath = process.env.PARITY_REPORT_PATH ?? "go-live-reports/env-parity.json";

const REQUIRED_SHARED_KEYS = [
  "DATABASE_URL",
  "JWT_SECRET",
  "REDIS_URL",
  "PHYSICAL_COMMAND_EXECUTION_ENABLED",
  "HIL_PLANT_APPROVAL_CONFIRMED",
  "PILOT_LOCK_PHYSICAL_EXECUTION",
  "EDGE_ALLOW_LEGACY_SHARED_SECRET",
  "DEVICE_SECRET_VAULT_PROVIDER",
  "GRIDFLEX_OPERATING_MODE"
];

const parseKeys = (raw) => {
  const keys = new Set();
  const values = new Map();
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    const key = eq >= 0 ? trimmed.slice(0, eq).trim() : trimmed;
    const value = eq >= 0 ? trimmed.slice(eq + 1).trim() : "";
    if (!key) continue;
    keys.add(key);
    values.set(key, value);
  }
  return { keys, values };
};

const diffSet = (source, target) => {
  const diff = [];
  for (const key of source) {
    if (!target.has(key)) diff.push(key);
  }
  return diff.sort((a, b) => a.localeCompare(b));
};

const schemaHash = (keys) =>
  createHash("sha256").update([...keys].sort().join("\n")).digest("hex");

const main = async () => {
  const stagingPath = path.resolve(stagingFile);
  const productionPath = path.resolve(productionFile);
  const [stagingRaw, productionRaw] = await Promise.all([
    fs.readFile(stagingPath, "utf8"),
    fs.readFile(productionPath, "utf8")
  ]);

  const staging = parseKeys(stagingRaw);
  const production = parseKeys(productionRaw);

  const missingInProduction = diffSet(staging.keys, production.keys);
  const missingInStaging = diffSet(production.keys, staging.keys);
  const missingRequired = REQUIRED_SHARED_KEYS.filter((k) => !production.keys.has(k) || !staging.keys.has(k));

  const unsafe = [];
  const approvedDifferences = [
    {
      key: "GRIDFLEX_OPERATING_MODE",
      staging: "SIMULATION|HIL",
      production: "PILOT_LIVE|PRODUCTION_ADVISORY",
      reason: "Operating mode intentionally differs by environment"
    }
  ];

  // Boolean policy checks against key-file defaults when present
  const prodPhysical = production.values.get("PHYSICAL_COMMAND_EXECUTION_ENABLED");
  const prodHil = production.values.get("HIL_PLANT_APPROVAL_CONFIRMED");
  const prodLegacy = production.values.get("EDGE_ALLOW_LEGACY_SHARED_SECRET");
  const prodVault = production.values.get("DEVICE_SECRET_VAULT_PROVIDER");

  if (prodPhysical && prodPhysical.toLowerCase() !== "false") {
    unsafe.push("PHYSICAL_COMMAND_EXECUTION_ENABLED must be false in production key template");
  }
  if (prodHil && prodHil.toLowerCase() !== "false") {
    unsafe.push("HIL_PLANT_APPROVAL_CONFIRMED must be false in production key template until dual-flag arming");
  }
  const prodPilotLock = production.values.get("PILOT_LOCK_PHYSICAL_EXECUTION");
  if (prodPilotLock && prodPilotLock.toLowerCase() !== "true") {
    unsafe.push("PILOT_LOCK_PHYSICAL_EXECUTION should be true in production key template for pilot");
  }
  if (prodLegacy && prodLegacy.toLowerCase() !== "false") {
    unsafe.push("EDGE_ALLOW_LEGACY_SHARED_SECRET should be false in production");
  }
  if (prodVault && prodVault === "local") {
    unsafe.push("DEVICE_SECRET_VAULT_PROVIDER=local is forbidden in production — use aws_kms");
  }
  if (prodVault && !["local", "aws_kms", "azure_key_vault", "gcp_kms"].includes(prodVault)) {
    unsafe.push(`Unsupported DEVICE_SECRET_VAULT_PROVIDER in production template: ${prodVault}`);
  }

  if (productionEnvFile) {
    try {
      const live = parseKeys(await fs.readFile(path.resolve(productionEnvFile), "utf8"));
      const livePhysical = (live.values.get("PHYSICAL_COMMAND_EXECUTION_ENABLED") || "").toLowerCase();
      if (livePhysical && livePhysical !== "false") {
        unsafe.push("Live PRODUCTION_ENV_FILE has PHYSICAL_COMMAND_EXECUTION_ENABLED enabled");
      }
    } catch (error) {
      unsafe.push(`Could not read PRODUCTION_ENV_FILE: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const pass =
    missingInProduction.length === 0 &&
    missingInStaging.length === 0 &&
    missingRequired.length === 0 &&
    unsafe.length === 0;

  const report = {
    generatedAt: new Date().toISOString(),
    pass,
    stagingKeys: staging.keys.size,
    productionKeys: production.keys.size,
    stagingSchemaHash: schemaHash(staging.keys),
    productionSchemaHash: schemaHash(production.keys),
    missingInProduction,
    missingInStaging,
    missingRequired,
    unsafe,
    approvedDifferences
  };

  await fs.mkdir(path.dirname(path.resolve(reportPath)), { recursive: true });
  await fs.writeFile(path.resolve(reportPath), `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(`Staging keys: ${staging.keys.size}`);
  console.log(`Production keys: ${production.keys.size}`);
  console.log(`Schema hash staging: ${report.stagingSchemaHash}`);
  console.log(`Schema hash production: ${report.productionSchemaHash}`);
  console.log(`Report: ${reportPath}`);
  console.log(pass ? "Environment key parity check: PASS" : "Environment key parity check: FAIL");

  if (!pass) {
    if (missingInProduction.length) console.log("Missing in production:", missingInProduction.join(", "));
    if (missingInStaging.length) console.log("Missing in staging:", missingInStaging.join(", "));
    if (missingRequired.length) console.log("Missing required:", missingRequired.join(", "));
    if (unsafe.length) console.log("Unsafe:\n- " + unsafe.join("\n- "));
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
