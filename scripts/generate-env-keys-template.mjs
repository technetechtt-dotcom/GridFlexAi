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

const parseExistingValues = (raw) => {
  const values = new Map();
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const separator = trimmed.indexOf("=");
    values.set(trimmed.slice(0, separator).trim(), trimmed.slice(separator + 1).trim());
  }
  return values;
};

const renderTemplate = (title, keys, existingValues) => {
  const header = [
    `# ${title}`,
    "# Keys only for parity comparison. Do not store secret values here.",
    "# Populate with KEY names or KEY=placeholder lines."
  ];
  const body = keys.map((key) => `${key}=${existingValues.get(key) ?? ""}`);
  return [...header, "", ...body, ""].join("\n");
};

const main = async () => {
  const envExampleRaw = await fs.readFile(envExamplePath, "utf8");
  const exampleKeys = parseKeys(envExampleRaw);

  await fs.mkdir(outputDir, { recursive: true });
  const stagingPath = path.join(outputDir, "staging.env.keys");
  const productionPath = path.join(outputDir, "production.env.keys");
  const [stagingExisting, productionExisting] = await Promise.all([
    fs.readFile(stagingPath, "utf8").catch(() => ""),
    fs.readFile(productionPath, "utf8").catch(() => "")
  ]);
  const stagingValues = parseExistingValues(stagingExisting);
  const productionValues = parseExistingValues(productionExisting);
  const uniqueSortedKeys = Array.from(
    new Set([...exampleKeys, ...stagingValues.keys(), ...productionValues.keys()])
  ).sort((a, b) => a.localeCompare(b));

  await Promise.all([
    fs.writeFile(
      stagingPath,
      renderTemplate("Staging Environment Keys", uniqueSortedKeys, stagingValues),
      "utf8"
    ),
    fs.writeFile(
      productionPath,
      renderTemplate("Production Environment Keys", uniqueSortedKeys, productionValues),
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
