/**
 * Production-like Northern Cape solar recovery demonstration.
 * Generates deterministic day-curve samples, calls the recovery engine via
 * dynamic import of compiled logic through a small Node reimplementation of
 * the HTTP contract against a live base URL when BASE_URL + TOKEN are set,
 * otherwise writes offline evidence from the same sample pattern.
 *
 *   node scripts/recovery-solar-demo.mjs
 *   BASE_URL=https://... TOKEN=... node scripts/recovery-solar-demo.mjs
 */
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const outDir = path.resolve("go-live-reports", "recovery-demo-2026-10-08");
const baseUrl = (process.env.BASE_URL || "").replace(/\/$/, "");
const token = process.env.TOKEN || "";

/** Deterministic 10-minute Northern Cape PV curve with an export-limit event. */
const buildSolarDay = () => {
  const start = Date.UTC(2026, 9, 8, 6, 0, 0);
  const exportLimitKw = 480;
  return Array.from({ length: 48 }, (_, index) => {
    const hour = 6 + index / 6;
    const clearSky = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI) * 720);
    const expectedPowerKw = Number(clearSky.toFixed(1));
    const constrained = hour >= 10 && hour <= 14.5 && expectedPowerKw > exportLimitKw;
    const actualPowerKw = constrained
      ? Number((exportLimitKw - 2 + (index % 3)).toFixed(1))
      : Number((expectedPowerKw * 0.97).toFixed(1));
    return {
      timestamp: new Date(start + index * 10 * 60 * 1000).toISOString(),
      expectedPowerKw,
      actualPowerKw,
      exportLimitKw,
      irradianceWm2: Number((clearSky * 1.15).toFixed(0)),
      inverterAvailable: true,
      gridInstructionActive: false,
      expectedSourceType: "forecast",
      actualSourceType: "measured",
      quality: "valid"
    };
  });
};

const main = async () => {
  await fs.mkdir(outDir, { recursive: true });
  const samples = buildSolarDay();
  const requestBody = {
    samples,
    dataEnvironment: "synthetic_demo",
    annualEventDays: 120,
    estimatedCapexZar: 2_500_000,
    assumptions: {
      intervalMinutes: 10,
      tariffZarPerKwh: 2.25,
      flexibleLoadCapacityKw: 180,
      batteryUsableEnergyKwh: 300,
      electrolyserCapacityKw: 120
    }
  };

  await fs.writeFile(
    path.join(outDir, "request.json"),
    `${JSON.stringify(requestBody, null, 2)}\n`,
    "utf8"
  );

  let analysis = null;
  let mode = "offline-request-only";
  if (baseUrl && token) {
    const response = await fetch(`${baseUrl}/api/recovery/analyse`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });
    const body = await response.json();
    analysis = body.data ?? body;
    mode = "live-api";
    await fs.writeFile(
      path.join(outDir, "response.json"),
      `${JSON.stringify(body, null, 2)}\n`,
      "utf8"
    );
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    mode,
    sampleCount: samples.length,
    exportLimitKw: 480,
    constrainedWindow: "10:00–14:30 local-equivalent UTC demo day",
    expectedDominantCause: "export_limit",
    observedDominantCause: analysis?.dominantCause ?? null,
    lostEnergyKwh: analysis?.lostEnergyKwh ?? null,
    affectedDurationHours: analysis?.affectedDurationHours ?? null,
    algorithmVersion: analysis?.algorithmVersion ?? null,
    physicalExecution: "disabled",
    videoNote:
      "Competition demo video: capture Recovery Centre screen recording separately; place MP4 beside this pack as recovery-demo.mp4"
  };

  const summaryJson = `${JSON.stringify(summary, null, 2)}\n`;
  await fs.writeFile(path.join(outDir, "summary.json"), summaryJson, "utf8");
  const sha = createHash("sha256").update(summaryJson).digest("hex");
  await fs.writeFile(path.join(outDir, "summary.json.sha256"), `${sha}  summary.json\n`, "utf8");

  const readme = `# Recovery demonstration evidence pack (2026-10-08)

- Scenario: Northern Cape clear-sky PV day with 480 kW export limit.
- Samples: 48 × 10-minute intervals (deterministic).
- Mode: ${mode}
- Physical execution: disabled
- Video: add \`recovery-demo.mp4\` (screen capture of Recovery Centre) when recorded.

## Files
- request.json — samples + assumptions sent to /api/recovery/analyse
- response.json — present only for live-api mode
- summary.json — compact evidence ledger
- summary.json.sha256 — integrity digests
`;
  await fs.writeFile(path.join(outDir, "README.md"), readme, "utf8");

  console.log(JSON.stringify({ ok: true, outDir, sha256: sha, mode }, null, 2));
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
