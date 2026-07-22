import fs from "node:fs/promises";
import path from "node:path";

import { runGoLiveVerification } from "./lib/go-live-verifier.mjs";

const required = ["STAGING_GO_LIVE_BASE_URL", "STAGING_GO_LIVE_EMAIL", "STAGING_GO_LIVE_PASSWORD"];
const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
  throw new Error(`Missing required staging env vars: ${missing.join(", ")}`);
}

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
  requireAuthFlow: true
};

const writeReport = async (checks) => {
  await fs.mkdir(path.dirname(config.outputFile), { recursive: true });
  const payload = {
    mode: "full-staging",
    baseUrl: config.baseUrl,
    generatedAt: new Date().toISOString(),
    checks
  };
  await fs.writeFile(config.outputFile, JSON.stringify(payload, null, 2), "utf8");
};

const main = async () => {
  const checks = await runGoLiveVerification(config);
  await writeReport(checks);

  // eslint-disable-next-line no-console
  console.log(`Staging full go-live verification passed against ${config.baseUrl}`);
  // eslint-disable-next-line no-console
  console.log(`Verification report written to ${config.outputFile}`);
};

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
