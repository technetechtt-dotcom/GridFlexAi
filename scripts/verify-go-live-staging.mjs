import fs from "node:fs/promises";
import path from "node:path";

import { runGoLiveVerification } from "./lib/go-live-verifier.mjs";

const required = ["STAGING_GO_LIVE_BASE_URL", "STAGING_GO_LIVE_EMAIL", "STAGING_GO_LIVE_PASSWORD"];
const missing = required.filter((key) => !process.env[key]);

const outputFile =
  process.env.STAGING_GO_LIVE_OUTPUT_FILE ?? path.join("go-live-reports", "staging-go-live-verification.json");

const config = {
  baseUrl: process.env.STAGING_GO_LIVE_BASE_URL,
  skipTlsVerify: process.env.GO_LIVE_SKIP_TLS_VERIFY === "true",
  email: process.env.STAGING_GO_LIVE_EMAIL,
  password: process.env.STAGING_GO_LIVE_PASSWORD,
  lat: Number.parseFloat(process.env.GO_LIVE_FORECAST_LAT ?? "-28.4478"),
  lon: Number.parseFloat(process.env.GO_LIVE_FORECAST_LON ?? "21.2561"),
  capacity: Number.parseFloat(process.env.GO_LIVE_FORECAST_CAPACITY ?? "220"),
  outputFile,
  requireAuthFlow: true,
  requireReleaseIdentity: true,
  expectedGitSha: process.env.EXPECTED_GIT_SHA,
  expectedImageDigest: process.env.EXPECTED_IMAGE_DIGEST,
  frontendOrigin: process.env.STAGING_FRONTEND_ORIGIN
};

const writeReport = async (checks, passed = true, error = null) => {
  await fs.mkdir(path.dirname(config.outputFile), { recursive: true });
  const payload = {
    mode: "full-staging",
    baseUrl: config.baseUrl,
    generatedAt: new Date().toISOString(),
    passed,
    error,
    checks
  };
  await fs.writeFile(config.outputFile, JSON.stringify(payload, null, 2), "utf8");
};

const main = async () => {
  if (missing.length > 0) throw new Error(`Missing required staging env vars: ${missing.join(", ")}`);
  const checks = await runGoLiveVerification(config);
  await writeReport(checks);

  // eslint-disable-next-line no-console
  console.log(`Staging full go-live verification passed against ${config.baseUrl}`);
  // eslint-disable-next-line no-console
  console.log(`Verification report written to ${config.outputFile}`);
};

main().catch(async (error) => {
  await writeReport(error.checks ?? [], false, error.message);
  // eslint-disable-next-line no-console
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
