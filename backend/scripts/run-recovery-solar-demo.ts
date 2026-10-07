import fs from "node:fs";
import path from "node:path";

import { analyseRecoveryOpportunity } from "../src/domain/recovery-engine.js";

const outDir = path.resolve(process.cwd(), "..", "go-live-reports", "recovery-demo-2026-10-08");
const requestPath = path.join(outDir, "request.json");
const request = JSON.parse(fs.readFileSync(requestPath, "utf8")) as {
  samples: Parameters<typeof analyseRecoveryOpportunity>[0];
  assumptions?: Parameters<typeof analyseRecoveryOpportunity>[1] extends infer T
    ? T extends { assumptions?: infer A }
      ? A
      : never
    : never;
  dataEnvironment?: "synthetic_demo" | "live" | "simulation" | "hil";
  annualEventDays?: number;
  estimatedCapexZar?: number;
};

const analysis = analyseRecoveryOpportunity(request.samples, {
  assumptions: request.assumptions,
  dataEnvironment: request.dataEnvironment ?? "synthetic_demo",
  annualEventDays: request.annualEventDays,
  estimatedCapexZar: request.estimatedCapexZar
});

fs.writeFileSync(path.join(outDir, "response.json"), `${JSON.stringify({ data: analysis }, null, 2)}\n`);

const summary = {
  generatedAt: new Date().toISOString(),
  mode: "offline-engine",
  sampleCount: request.samples.length,
  dominantCause: analysis.dominantCause,
  lostEnergyKwh: analysis.lostEnergyKwh,
  affectedDurationHours: analysis.affectedDurationHours,
  revenueAtRiskZar: analysis.revenueAtRiskZar,
  algorithmVersion: analysis.algorithmVersion,
  physicalExecution: "disabled"
};
fs.writeFileSync(path.join(outDir, "engine-summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
