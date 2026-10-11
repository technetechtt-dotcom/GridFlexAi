/**
 * Verify a recovery report HTML/JSON evidence file contains required honesty markers.
 *
 *   npm run verify:recovery-report
 *   npm run verify:recovery-report -- go-live-reports/recovery-demo-2026-10-08/report.html
 */
import fs from "node:fs/promises";
import path from "node:path";

const argPath = process.argv[2];
const defaultDir = path.resolve("go-live-reports", "recovery-demo-2026-10-08");

const requiredAny = [
  "synthetic",
  "synthetic_demo",
  "advisory",
  "illustrative",
  "physical"
];

const main = async () => {
  let target = argPath ? path.resolve(argPath) : null;
  if (!target) {
    const entries = await fs.readdir(defaultDir).catch(() => []);
    const preferred =
      entries.find((name) => name.endsWith(".html")) ||
      entries.find((name) => name.endsWith(".json")) ||
      entries[0];
    if (!preferred) {
      console.error(`No report found. Run: npm run demo:recovery-solar`);
      process.exit(1);
    }
    target = path.join(defaultDir, preferred);
  }

  const text = await fs.readFile(target, "utf8");
  const lower = text.toLowerCase();
  const hits = requiredAny.filter((token) => lower.includes(token.toLowerCase()));

  console.log(`Report: ${target}`);
  console.log(`Bytes: ${Buffer.byteLength(text)}`);
  console.log(`Honesty markers found: ${hits.join(", ") || "(none)"}`);

  if (hits.length < 2) {
    console.error("FAIL: report lacks clear synthetic/advisory labeling.");
    process.exit(1);
  }

  if (lower.includes("customer settlement") && !lower.includes("illustrative")) {
    console.error("FAIL: possible customer-settlement claim without illustrative label.");
    process.exit(1);
  }

  console.log("PASS: recovery report carries competition-safe labeling.");
};

main();
