/**
 * Presence-only check for logs/alerts/metrics keys. Never prints values.
 *
 *   node scripts/verify-observability-readiness.mjs
 */
import fs from "node:fs/promises";
import path from "node:path";

const outFile =
  process.env.OBSERVABILITY_READINESS_OUTPUT ||
  path.resolve("go-live-reports", "observability-readiness.json");

const required = [
  "METRICS_SCRAPE_TOKEN",
  "ALERT_WEBHOOK_ENABLED",
  "ALERT_WEBHOOK_URL",
  "ALERT_WEBHOOK_TOKEN"
];
const optional = ["OTEL_SERVICE_NAME", "ALERT_WEBHOOK_COOLDOWN_MS", "ALERT_WEBHOOK_TIMEOUT_MS"];

const isSet = (value) => typeof value === "string" && value.trim().length > 0;

const main = async () => {
  const checks = {};
  const blockers = [];
  for (const key of required) {
    const present = isSet(process.env[key]);
    checks[key] = { present };
    if (!present) blockers.push(`Missing ${key}`);
  }
  for (const key of optional) {
    checks[key] = { present: isSet(process.env[key]) };
  }
  if (process.env.ALERT_WEBHOOK_ENABLED === "true" && !isSet(process.env.ALERT_WEBHOOK_URL)) {
    blockers.push("ALERT_WEBHOOK_ENABLED=true requires ALERT_WEBHOOK_URL");
  }
  if (isSet(process.env.ALERT_WEBHOOK_URL) && !/^https:\/\//i.test(process.env.ALERT_WEBHOOK_URL)) {
    blockers.push("ALERT_WEBHOOK_URL must be https");
  }

  const report = {
    generatedAt: new Date().toISOString(),
    pass: blockers.length === 0,
    blockers,
    checks,
    nextActions: blockers.length
      ? [
          "Set METRICS_SCRAPE_TOKEN and ALERT_WEBHOOK_* on Render (never commit)",
          "Attach host log drain (Better Stack / Datadog / CloudWatch)",
          "ALERT_FIRE_DRILL_ALLOW=true npm run drill:alert-webhook locally, then ack a live staging alert"
        ]
      : ["Run live fire-drill and record deliver/ack in docs/observability/alert-review.md"]
  };

  await fs.mkdir(path.dirname(outFile), { recursive: true });
  await fs.writeFile(outFile, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ pass: report.pass, blockerCount: blockers.length, blockers, reportPath: outFile }, null, 2));
  process.exit(report.pass ? 0 : 2);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
