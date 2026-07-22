import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";

const evidenceDir = path.resolve(process.env.CI_EVIDENCE_DIR ?? "ci-evidence");
const outputDir = path.resolve(process.env.CI_EVIDENCE_OUTPUT_DIR ?? evidenceDir);

const resolveCommitSha = () => {
  const value =
    process.env.GIT_COMMIT_SHA ??
    process.env.GITHUB_SHA ??
    execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  if (!/^[0-9a-f]{40}$/i.test(value)) {
    throw new Error("A full 40-character Git commit SHA is required.");
  }
  return value.toLowerCase();
};

const listFiles = async (directory) => {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const filePath = path.join(directory, entry.name);
      return entry.isDirectory() ? listFiles(filePath) : [filePath];
    })
  );
  return nested.flat();
};

const sha256 = (content) => createHash("sha256").update(content).digest("hex");

const main = async () => {
  const commitSha = resolveCommitSha();
  await fs.mkdir(outputDir, { recursive: true });

  const manifestPath = path.join(outputDir, "release-evidence-manifest.json");
  const checksumPath = `${manifestPath}.sha256`;
  const ignored = new Set([manifestPath, checksumPath].map((item) => path.resolve(item)));
  const files = (await listFiles(evidenceDir))
    .filter((filePath) => !ignored.has(path.resolve(filePath)))
    .sort((a, b) => a.localeCompare(b));

  if (files.length === 0) {
    throw new Error(`No CI evidence files found in ${evidenceDir}.`);
  }

  const artifacts = await Promise.all(
    files.map(async (filePath) => {
      const content = await fs.readFile(filePath);
      return {
        path: path.relative(evidenceDir, filePath).split(path.sep).join("/"),
        bytes: content.byteLength,
        sha256: sha256(content)
      };
    })
  );

  const manifest = {
    schemaVersion: 1,
    commitSha,
    repository: process.env.GITHUB_REPOSITORY ?? null,
    workflowRun: process.env.GITHUB_RUN_ID
      ? {
          id: process.env.GITHUB_RUN_ID,
          attempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
          url: process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY
            ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
            : null
        }
      : null,
    generatedAt: new Date().toISOString(),
    artifacts
  };

  const body = `${JSON.stringify(manifest, null, 2)}\n`;
  await fs.writeFile(manifestPath, body, "utf8");
  await fs.writeFile(
    checksumPath,
    `${sha256(body)}  ${path.basename(manifestPath)}\n`,
    "utf8"
  );
  console.log(`Evidence manifest contains ${artifacts.length} commit-bound files.`);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
