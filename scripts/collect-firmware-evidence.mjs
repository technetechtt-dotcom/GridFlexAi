import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";

const environments = ["esp32s3-wifi-ci", "esp32s3-lte-ci"];
const projectDir = path.resolve("firmware");
const outputRoot = path.resolve(process.env.FIRMWARE_EVIDENCE_DIR ?? "ci-evidence/firmware");

const commitSha = (
  process.env.GITHUB_SHA ??
  execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim()
).toLowerCase();
if (!/^[0-9a-f]{40}$/.test(commitSha)) {
  throw new Error("Firmware evidence requires a full 40-character Git commit SHA.");
}

const sha256 = (content) => createHash("sha256").update(content).digest("hex");

const main = async () => {
  for (const environment of environments) {
    const buildDir = path.join(projectDir, ".pio", "build", environment);
    const outputDir = path.join(outputRoot, environment);
    await fs.mkdir(outputDir, { recursive: true });

    const candidates = ["firmware.bin", "bootloader.bin", "partitions.bin"];
    const copied = [];
    for (const filename of candidates) {
      const source = path.join(buildDir, filename);
      const content = await fs.readFile(source).catch(() => null);
      if (!content) {
        if (filename === "firmware.bin") {
          throw new Error(`Required output missing: ${source}`);
        }
        continue;
      }
      await fs.writeFile(path.join(outputDir, filename), content);
      copied.push({ filename, bytes: content.byteLength, sha256: sha256(content) });
    }

    const checksums = copied.map((file) => `${file.sha256}  ${file.filename}`).join("\n");
    await fs.writeFile(path.join(outputDir, "SHA256SUMS"), `${checksums}\n`, "utf8");
    await fs.writeFile(
      path.join(outputDir, "build-metadata.json"),
      `${JSON.stringify(
        {
          schemaVersion: 1,
          commitSha,
          environment,
          platformioVersion: process.env.PLATFORMIO_VERSION ?? "unknown",
          workflowRunId: process.env.GITHUB_RUN_ID ?? null,
          generatedAt: new Date().toISOString(),
          outputs: copied
        },
        null,
        2
      )}\n`,
      "utf8"
    );
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
