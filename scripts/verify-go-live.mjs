import fs from "node:fs/promises";

import { runGoLiveVerification } from "./lib/go-live-verifier.mjs";

const config = {
  baseUrl: process.env.GO_LIVE_BASE_URL ?? "https://localhost:4443",
  skipTlsVerify: process.env.GO_LIVE_SKIP_TLS_VERIFY === "true",
  email: process.env.GO_LIVE_EMAIL ?? "",
  password: process.env.GO_LIVE_PASSWORD ?? "",
  lat: Number.parseFloat(process.env.GO_LIVE_FORECAST_LAT ?? "-28.4478"),
  lon: Number.parseFloat(process.env.GO_LIVE_FORECAST_LON ?? "21.2561"),
  capacity: Number.parseFloat(process.env.GO_LIVE_FORECAST_CAPACITY ?? "220"),
  outputFile: process.env.GO_LIVE_OUTPUT_FILE ?? "",
  requireAuthFlow: false
};

const writeOutputFileIfNeeded = async () => {
  if (!config.outputFile) return;
  const payload = {
    baseUrl: config.baseUrl,
    generatedAt: new Date().toISOString(),
    checks: results
  };
  await fs.writeFile(config.outputFile, JSON.stringify(payload, null, 2), "utf8");
};

const main = async () => {
  results = await runGoLiveVerification(config);

  await writeOutputFileIfNeeded();

  // eslint-disable-next-line no-console
  console.log(`Go-live verification passed against ${config.baseUrl}`);
  if (!config.email || !config.password) {
    // eslint-disable-next-line no-console
    console.log("Auth flow skipped (set GO_LIVE_EMAIL and GO_LIVE_PASSWORD to enable full checks).");
  }
  if (config.outputFile) {
    // eslint-disable-next-line no-console
    console.log(`Verification report written to ${config.outputFile}`);
  }
};

let results = [];

main().catch(async (error) => {
  try {
    await writeOutputFileIfNeeded();
  } catch {
    // ignore file write failure in error path
  }
  // eslint-disable-next-line no-console
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
