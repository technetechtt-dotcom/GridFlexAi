#!/usr/bin/env node
/**
 * Validate frozen GCIP demo pack arithmetic without a browser build.
 * Mirrors src/lib/pilotCase.ts — keep in sync when freezing a new version.
 */
const FROZEN_DEMO_PACK_VERSION = "gcip-demo-2026-10-12.1";

const pilot = {
  frozenVersion: FROZEN_DEMO_PACK_VERSION,
  generation: { actualMWh: 11240, expectedMWh: 12860 },
  loss: { identifiedMWh: 1620, remainingMWh: 410 },
  impact: {
    recoveredOrRecoverableMWh: 1210,
    tariffZarPerKwh: 1.55,
    financialValueZar: 1_875_500,
    emissionsFactorKgPerKwh: 0.95,
    avoidedCo2t: 1149.5
  }
};

const errors = [];
const identified = pilot.generation.expectedMWh - pilot.generation.actualMWh;
if (Math.abs(identified - pilot.loss.identifiedMWh) > 0.01) {
  errors.push(`identified loss mismatch: ${identified} vs ${pilot.loss.identifiedMWh}`);
}
const recoverable = pilot.loss.identifiedMWh - pilot.loss.remainingMWh;
if (Math.abs(recoverable - pilot.impact.recoveredOrRecoverableMWh) > 0.01) {
  errors.push(`recoverable mismatch: ${recoverable} vs ${pilot.impact.recoveredOrRecoverableMWh}`);
}
const financial = pilot.impact.recoveredOrRecoverableMWh * 1000 * pilot.impact.tariffZarPerKwh;
if (Math.abs(financial - pilot.impact.financialValueZar) > 1) {
  errors.push(`financial mismatch: ${financial} vs ${pilot.impact.financialValueZar}`);
}
const carbon =
  (pilot.impact.recoveredOrRecoverableMWh * 1000 * pilot.impact.emissionsFactorKgPerKwh) / 1000;
if (Math.abs(carbon - pilot.impact.avoidedCo2t) > 0.05) {
  errors.push(`carbon mismatch: ${carbon} vs ${pilot.impact.avoidedCo2t}`);
}

if (errors.length) {
  console.error("FROZEN DEMO PACK INVALID:");
  for (const e of errors) console.error(` - ${e}`);
  process.exit(1);
}

console.log(`OK frozen demo pack ${FROZEN_DEMO_PACK_VERSION}`);
console.log("Site claim: synthetic NC demo plant only (no third-party brand).");
console.log("Reviewer claim: internal GridFlex pilot desk (not independent auditor).");
console.log('Measured (pack): means synthetic pack semantics — not commercial meter settlement.');
console.log("Funding ask (product): R 1,950,000 for 90-day telemetry-only pilot.");
