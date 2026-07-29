/**
 * Run npm audit --omit=dev and fail on HIGH/CRITICAL unless covered by an
 * unexpired HIGH exception in security/vulnerability-exceptions.json.
 *
 * Usage: node scripts/npm-audit-ci.mjs [cwd]
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const cwd = path.resolve(process.argv[2] || ".");
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const registryCandidates = [
  process.env.VULNERABILITY_EXCEPTION_FILE,
  path.join(repoRoot, "security/vulnerability-exceptions.json"),
  path.resolve("security/vulnerability-exceptions.json"),
  path.resolve(cwd, "security/vulnerability-exceptions.json"),
  path.resolve(cwd, "../security/vulnerability-exceptions.json")
].filter(Boolean);

let registryRaw = null;
let usedRegistry = null;
for (const candidate of registryCandidates) {
  try {
    registryRaw = fs.readFileSync(candidate, "utf8");
    usedRegistry = candidate;
    break;
  } catch {
    // try next
  }
}
if (!registryRaw) {
  console.error("Unable to read security/vulnerability-exceptions.json");
  process.exit(1);
}

const registry = JSON.parse(registryRaw);
const now = Date.now();
const allowedHigh = new Set(
  (registry.exceptions || [])
    .filter((entry) => entry.severity === "HIGH" && Date.parse(entry.expiresAt) > now)
    .map((entry) => String(entry.id).toUpperCase())
);

const result = spawnSync("npm", ["audit", "--omit=dev", "--json"], {
  cwd,
  encoding: "utf8",
  maxBuffer: 20 * 1024 * 1024,
  shell: true
});

if (!result.stdout || !result.stdout.trim()) {
  console.error(result.stderr || "npm audit produced no stdout");
  process.exit(1);
}

let report;
try {
  report = JSON.parse(result.stdout);
} catch {
  console.error("npm audit produced non-JSON output");
  console.error(result.stdout.slice(0, 500));
  process.exit(1);
}

const vulnerabilities = report.vulnerabilities || {};

const ghsaFromViaItem = (item) => {
  if (!item || typeof item !== "object") return null;
  if (typeof item.url === "string") {
    const match = item.url.match(/GHSA-[a-z0-9-]+/i);
    if (match) return match[0].toUpperCase();
  }
  if (typeof item.source === "string" && item.source.toUpperCase().startsWith("GHSA-")) {
    return item.source.toUpperCase();
  }
  return null;
};

/** Resolve GHSA ids for a package, following string via references. */
const resolveGhsaIds = (name, seen = new Set()) => {
  if (seen.has(name)) return [];
  seen.add(name);
  const vuln = vulnerabilities[name];
  if (!vuln) return [];
  const ids = [];
  for (const item of vuln.via || []) {
    if (typeof item === "string") {
      ids.push(...resolveGhsaIds(item, seen));
    } else {
      const id = ghsaFromViaItem(item);
      if (id) ids.push(id);
    }
  }
  return [...new Set(ids)];
};

const blockers = [];
const excepted = [];
for (const [name, vuln] of Object.entries(vulnerabilities)) {
  const severity = String(vuln.severity || "").toLowerCase();
  if (severity !== "high" && severity !== "critical") continue;
  const ids = resolveGhsaIds(name);
  const covered =
    severity === "high" && ids.length > 0 && ids.every((id) => allowedHigh.has(id));
  if (covered) {
    excepted.push({ name, severity, ids });
    continue;
  }
  blockers.push({
    name,
    severity,
    ids,
    range: vuln.range,
    fixAvailable: vuln.fixAvailable
  });
}

console.log(`npm audit registry: ${usedRegistry}`);
console.log(`Approved HIGH exceptions loaded: ${allowedHigh.size}`);

if (excepted.length > 0) {
  console.log(`npm audit: ${excepted.length} HIGH finding(s) covered by approved exceptions:`);
  for (const item of excepted) {
    console.log(`  - ${item.name}: ${item.ids.join(", ")}`);
  }
}

if (blockers.length > 0) {
  console.error(`npm audit: ${blockers.length} blocking HIGH/CRITICAL finding(s):`);
  for (const item of blockers) {
    console.error(
      `  - ${item.name} (${item.severity}) ids=${item.ids.join(",") || "n/a"} range=${item.range || "?"}`
    );
  }
  process.exit(1);
}

const highCount = report.metadata?.vulnerabilities?.high ?? 0;
const criticalCount = report.metadata?.vulnerabilities?.critical ?? 0;
if (highCount + criticalCount > 0 && excepted.length === 0) {
  console.error(
    `npm audit metadata reports high=${highCount} critical=${criticalCount} but none were classified; failing closed.`
  );
  process.exit(1);
}

console.log("npm audit: no blocking HIGH/CRITICAL production findings.");
process.exit(0);
