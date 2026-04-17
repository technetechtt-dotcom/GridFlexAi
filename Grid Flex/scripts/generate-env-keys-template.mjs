import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const envExamplePath = path.join(repoRoot, "backend", ".env.example");
const outputDir = path.join(repoRoot, "env-keys");

const parseKeys = (raw) =>
  raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => line.slice(0, line.indexOf("=")).trim())
    .filter(Boolean);

const renderTemplate = (title, keys) => {
  const header = [
    `# ${title}`,
    "# Keys only for parity comparison. Do not store secret values here.",
    "# Populate with KEY names or KEY=placeholder lines."
  ];
  const body = keys.map((key) => `${key}=`);
  return [...header, "", ...body, ""].join("\n");
};

const main = async () => {
  const envExampleRaw = await fs.readFile(envExamplePath, "utf8");
  const keys = parseKeys(envExampleRaw);
  const uniqueSortedKeys = Array.from(new Set(keys)).sort((a, b) => a.localeCompare(b));

  await fs.mkdir(outputDir, { recursive: true });
  await Promise.all([
    fs.writeFile(
      path.join(outputDir, "staging.env.keys"),
      renderTemplate("Staging Environment Keys", uniqueSortedKeys),
      "utf8"
    ),
    fs.writeFile(
      path.join(outputDir, "production.env.keys"),
      renderTemplate("Production Environment Keys", uniqueSortedKeys),
      "utf8"
    )
  ]);

  // eslint-disable-next-line no-console
  console.log(`Generated env key templates (${uniqueSortedKeys.length} keys) in ${outputDir}`);
};

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
