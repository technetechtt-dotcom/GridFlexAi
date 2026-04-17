import fs from "node:fs/promises";
import path from "node:path";

const stagingReportPath =
  process.env.STAGING_GO_LIVE_REPORT_FILE ?? path.join("go-live-reports", "staging-go-live-verification.json");
const productionReportPath =
  process.env.PRODUCTION_GO_LIVE_REPORT_FILE ?? path.join("go-live-reports", "production-go-live-verification.json");
const outputPath = process.env.GO_LIVE_SUMMARY_OUTPUT_FILE ?? path.join("go-live-reports", "summary.md");

const readJson = async (filePath, label) => {
  const resolved = path.resolve(filePath);
  const raw = await fs.readFile(resolved, "utf8").catch(() => {
    throw new Error(`Missing ${label} report: ${resolved}`);
  });
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON in ${label} report: ${resolved}`);
  }
  return { resolved, parsed };
};

const statusEmoji = (ok) => (ok ? "PASS" : "FAIL");

const buildSection = (title, reportPath, report) => {
  const checks = Array.isArray(report?.checks) ? report.checks : [];
  if (checks.length === 0) {
    throw new Error(`${title} report does not contain checks.`);
  }

  const passed = checks.filter((check) => check.ok === true).length;
  const failed = checks.length - passed;
  const overallOk = failed === 0;

  const lines = [
    `## ${title}`,
    "",
    `- Report file: \`${reportPath}\``,
    `- Base URL: \`${report.baseUrl ?? "unknown"}\``,
    `- Generated at: \`${report.generatedAt ?? "unknown"}\``,
    `- Result: **${statusEmoji(overallOk)}** (${passed}/${checks.length} passed)`,
    ""
  ];

  lines.push("| Check | Path | Expected | Actual | Result |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const check of checks) {
    lines.push(
      `| ${check.name ?? "unknown"} | \`${check.path ?? "-"}\` | ${check.expectedStatus ?? "-"} | ${check.actualStatus ?? "-"} | ${statusEmoji(check.ok === true)} |`
    );
  }
  lines.push("");

  return { lines, overallOk };
};

const main = async () => {
  const [stagingData, productionData] = await Promise.all([
    readJson(stagingReportPath, "staging"),
    readJson(productionReportPath, "production")
  ]);

  const stagingSection = buildSection("Staging Verification", stagingData.resolved, stagingData.parsed);
  const productionSection = buildSection("Production Verification", productionData.resolved, productionData.parsed);
  const overallOk = stagingSection.overallOk && productionSection.overallOk;

  const markdown = [
    "# Go-Live Verification Summary",
    "",
    `- Generated at: \`${new Date().toISOString()}\``,
    `- Overall result: **${statusEmoji(overallOk)}**`,
    "",
    ...stagingSection.lines,
    ...productionSection.lines,
    "## Go/No-Go",
    "",
    overallOk
      ? "- **GO**: staging and production verification checks are passing."
      : "- **NO-GO**: one or more checks failed. Resolve failures and regenerate this summary.",
    ""
  ].join("\n");

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, markdown, "utf8");

  // eslint-disable-next-line no-console
  console.log(`Go-live summary generated at ${path.resolve(outputPath)}`);
  if (!overallOk) {
    process.exitCode = 1;
  }
};

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
