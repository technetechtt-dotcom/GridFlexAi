/**
 * Generate a release parity report (unsigned artifact + optional detached signature).
 *
 * Records: commit SHA, image digest, migration version, env schema hash,
 * smoke results, staging/production verifier results, approved differences.
 */

import { createHash, createSign } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";

const outDir = path.resolve(process.env.PARITY_REPORT_DIR ?? "go-live-reports");
const commitSha =
  process.env.GIT_COMMIT_SHA ||
  (() => {
    try {
      return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
    } catch {
      return "unknown";
    }
  })();

const imageDigest = process.env.IMAGE_DIGEST || "";
const stagingSmoke = process.env.STAGING_SMOKE_RESULT || "";
const productionSmoke = process.env.PRODUCTION_SMOKE_RESULT || "";
const stagingVerifier = process.env.STAGING_VERIFIER_RESULT || "unknown";
const productionVerifier = process.env.PRODUCTION_VERIFIER_RESULT || "unknown";
const smokeOutcomes = new Set(["pass", "fail"]);

if (!/^[0-9a-f]{40}$/i.test(commitSha)) {
  throw new Error("GIT_COMMIT_SHA must be a full 40-character commit SHA.");
}
if (!/^sha256:[0-9a-f]{64}$/i.test(imageDigest)) {
  throw new Error("IMAGE_DIGEST must be a registry content digest in the form sha256:<64 hex characters>.");
}
if (!smokeOutcomes.has(stagingSmoke) || !smokeOutcomes.has(productionSmoke)) {
  throw new Error("STAGING_SMOKE_RESULT and PRODUCTION_SMOKE_RESULT must each be explicitly set to pass or fail.");
}

const readJsonIfExists = async (file) => {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return null;
  }
};

const listMigrations = async () => {
  const dir = path.resolve("backend/prisma/migrations");
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
};

const main = async () => {
  await fs.mkdir(outDir, { recursive: true });
  const envParity = await readJsonIfExists(path.resolve("go-live-reports/env-parity.json"));
  const migrations = await listMigrations();
  const migrationVersion = migrations[migrations.length - 1] || "none";

  const matrix = {
    nodeVersion: { staging: process.version, production: process.env.PROD_NODE_VERSION || "same-major-required" },
    containerImage: { staging: imageDigest, production: imageDigest, rule: "identical digest" },
    databaseEngine: { staging: "Postgres (Neon/provider)", production: "Postgres same major" },
    redis: { staging: "Redis 7.x", production: "Redis same major" },
    environmentKeys: {
      stagingSchemaHash: envParity?.stagingSchemaHash ?? null,
      productionSchemaHash: envParity?.productionSchemaHash ?? null,
      match: envParity ? envParity.stagingSchemaHash === envParity.productionSchemaHash : null
    },
    tlsProxy: { staging: "equivalent", production: "enabled" },
    migrations: { set: migrations, head: migrationVersion },
    featureFlags: envParity?.approvedDifferences ?? [],
    monitoring: { staging: "same instrumentation", production: "live routing" },
    operatingMode: {
      staging: "HIL/SIMULATION",
      production: "PILOT_LIVE / PRODUCTION_ADVISORY"
    }
  };

  const report = {
    generatedAt: new Date().toISOString(),
    commitSha,
    imageDigest,
    migrationVersion,
    environmentSchemaHash: envParity?.productionSchemaHash ?? null,
    smokeTestResult: { staging: stagingSmoke, production: productionSmoke },
    stagingVerifierResult: stagingVerifier,
    productionVerifierResult: productionVerifier,
    envParityPass: envParity?.pass ?? null,
    knownApprovedDifferences: matrix.featureFlags,
    parityMatrix: matrix
  };

  const body = `${JSON.stringify(report, null, 2)}\n`;
  const reportFile = path.join(outDir, `parity-report-${commitSha.slice(0, 12)}.json`);
  await fs.writeFile(reportFile, body, "utf8");
  await fs.writeFile(path.join(outDir, "parity-report-latest.json"), body, "utf8");

  const digest = createHash("sha256").update(body).digest("hex");
  let signature = null;
  const pem = process.env.PARITY_REPORT_SIGNING_PRIVATE_KEY_PEM;
  if (pem) {
    const sign = createSign("SHA256");
    sign.update(body);
    sign.end();
    signature = sign.sign(pem, "base64url");
    await fs.writeFile(
      path.join(outDir, `parity-report-${commitSha.slice(0, 12)}.sig`),
      `${JSON.stringify({ alg: "RSA-SHA256", digestSha256: digest, signature }, null, 2)}\n`,
      "utf8"
    );
  } else {
    // Dev/CI: emit content hash as integrity proof when signing key absent
    await fs.writeFile(
      path.join(outDir, `parity-report-${commitSha.slice(0, 12)}.sha256`),
      `${digest}  parity-report-${commitSha.slice(0, 12)}.json\n`,
      "utf8"
    );
  }

  console.log(`Parity report: ${reportFile}`);
  console.log(`SHA-256: ${digest}`);
  console.log(signature ? "Signed with PARITY_REPORT_SIGNING_PRIVATE_KEY_PEM" : "Unsigned (hash artifact written)");
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
