/**
 * Verify staging (or any env) advertises the expected signed image digest via /api/health.
 *
 *   EXPECTED_IMAGE_DIGEST=sha256:… STAGING_BASE_URL=https://… npm run verify:staging-digest
 *
 * Optional: EXPECTED_GIT_SHA=…
 * Writes go-live-reports/staging-digest-verify.json (+ .sha256).
 */
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const baseUrl = (process.env.STAGING_BASE_URL || process.env.BASE_URL || "").replace(/\/$/, "");
const expectedDigest = (process.env.EXPECTED_IMAGE_DIGEST || "").trim();
const expectedSha = (process.env.EXPECTED_GIT_SHA || "").trim();
const outFile =
  process.env.STAGING_DIGEST_OUTPUT ||
  path.resolve("go-live-reports", "staging-digest-verify.json");

if (!baseUrl) {
  console.error("STAGING_BASE_URL (or BASE_URL) is required");
  process.exit(2);
}
if (!/^sha256:[a-f0-9]{64}$/i.test(expectedDigest)) {
  console.error("EXPECTED_IMAGE_DIGEST must be sha256:<64 hex>");
  process.exit(2);
}

const main = async () => {
  const res = await fetch(`${baseUrl}/api/health`);
  const body = await res.json().catch(() => ({}));
  const observedDigest =
    typeof body?.release?.imageDigest === "string" ? body.release.imageDigest : null;
  const observedSha = typeof body?.release?.gitSha === "string" ? body.release.gitSha : null;

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    httpStatus: res.status,
    expected: { imageDigest: expectedDigest, gitSha: expectedSha || null },
    observed: { imageDigest: observedDigest, gitSha: observedSha, dependencies: body?.dependencies ?? null },
    pass: false,
    blockers: []
  };

  if (!res.ok) {
    report.blockers.push(`Health HTTP ${res.status}`);
  }
  if (!observedDigest) {
    report.blockers.push(
      "release.imageDigest missing — set RELEASE_IMAGE_DIGEST on the service (requires post-PR health payload)."
    );
  } else if (observedDigest.toLowerCase() !== expectedDigest.toLowerCase()) {
    report.blockers.push(`Digest mismatch: observed ${observedDigest}`);
  }
  if (expectedSha && observedSha && observedSha !== expectedSha) {
    report.blockers.push(`Git SHA mismatch: observed ${observedSha}`);
  }
  if (expectedSha && !observedSha) {
    report.blockers.push("release.gitSha missing while EXPECTED_GIT_SHA was set");
  }

  report.pass = report.blockers.length === 0;

  await fs.mkdir(path.dirname(outFile), { recursive: true });
  const json = `${JSON.stringify(report, null, 2)}\n`;
  await fs.writeFile(outFile, json, "utf8");
  const sha256 = createHash("sha256").update(json).digest("hex");
  await fs.writeFile(`${outFile}.sha256`, `${sha256}  ${path.basename(outFile)}\n`, "utf8");

  console.log(JSON.stringify({ ok: report.pass, sha256, blockers: report.blockers, evidence: outFile }, null, 2));
  process.exit(report.pass ? 0 : 1);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
