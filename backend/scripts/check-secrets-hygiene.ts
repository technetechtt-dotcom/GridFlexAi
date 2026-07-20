/**
 * Fail CI if *tracked* files look like they contain production secret material.
 * Uses `git ls-files` so local .env files are ignored.
 */

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(process.cwd(), "..");

const ALLOW_NAME = /(^|\/)(\.env\.example|.*\.env\.keys|.*\.md)$/i;

const FORBIDDEN = [
  /-----BEGIN (RSA |EC |OPENSSH |PRIVATE )?PRIVATE KEY-----/,
  /AKIA[0-9A-Z]{16}/,
  /postgres:\/\/[^:\s]+:[^@\s]{8,}@(?!localhost|127\.0\.0\.1)/i,
  /redis:\/\/:[^@\s]+@(?!localhost|127\.0\.0\.1)/i,
  /sk-proj-[A-Za-z0-9_-]{20,}/,
  /sk-live-[A-Za-z0-9_-]{20,}/
];

const tracked = execSync("git ls-files", { cwd: ROOT, encoding: "utf8" })
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean)
  .filter((rel) => {
    if (ALLOW_NAME.test(rel)) return false;
    if (/\.(png|jpg|jpeg|ico|woff2?|zip|tsbuildinfo)$/i.test(rel)) return false;
    return /\.(ts|tsx|js|jsx|json|yml|yaml|env|toml|sh|ps1|ino|csv)$/i.test(rel) || /Dockerfile/i.test(rel);
  });

const findings: Array<{ file: string; pattern: string }> = [];

for (const rel of tracked) {
  let text: string;
  try {
    text = readFileSync(join(ROOT, rel), "utf8");
  } catch {
    continue;
  }
  if (text.length > 2_000_000) continue;
  for (const pattern of FORBIDDEN) {
    if (pattern.test(text)) {
      findings.push({ file: rel, pattern: String(pattern) });
    }
  }
}

if (findings.length > 0) {
  process.stderr.write("[check:secrets-hygiene] Possible committed secrets:\n");
  for (const f of findings) {
    process.stderr.write(`  - ${f.file} matches ${f.pattern}\n`);
  }
  process.exit(1);
}

process.stdout.write(`[check:secrets-hygiene] OK (${tracked.length} tracked files scanned)\n`);
