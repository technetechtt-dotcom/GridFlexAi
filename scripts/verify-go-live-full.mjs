import fs from "node:fs/promises";

import { runGoLiveVerification } from "./lib/go-live-verifier.mjs";

const required = ["GO_LIVE_BASE_URL", "GO_LIVE_EMAIL", "GO_LIVE_PASSWORD"];
const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
  throw new Error(`Missing required env vars for full go-live verification: ${missing.join(", ")}`);
}

const config = {
  baseUrl: process.env.GO_LIVE_BASE_URL,
  skipTlsVerify: process.env.GO_LIVE_SKIP_TLS_VERIFY === "true",
  email: process.env.GO_LIVE_EMAIL,
  password: process.env.GO_LIVE_PASSWORD,
  lat: Number.parseFloat(process.env.GO_LIVE_FORECAST_LAT ?? "-28.4478"),
  lon: Number.parseFloat(process.env.GO_LIVE_FORECAST_LON ?? "21.2561"),
  capacity: Number.parseFloat(process.env.GO_LIVE_FORECAST_CAPACITY ?? "220"),
  outputFile: process.env.GO_LIVE_OUTPUT_FILE ?? "go-live-verification.json",
  requireAuthFlow: true
};

const writeReport = async (checks) => {
  const payload = {
    mode: "full",
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
  console.log(`Full go-live verification passed against ${config.baseUrl}`);
  // eslint-disable-next-line no-console
  console.log(`Verification report written to ${config.outputFile}`);
};

main().catch(async (error) => {
  // eslint-disable-next-line no-console
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
