import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve from this script, never from a caller's directory or a sibling checkout.
const root = fileURLToPath(new URL('../', import.meta.url));
const backend = path.join(root, 'backend');
const steps = [
  ['Release verifier regression tests', root, 'scripts/tests/go-live-verifier.test.mjs'],
  ['Frontend types', root, 'node_modules/typescript/bin/tsc', '-b'],
  ['Backend types', backend, 'node_modules/typescript/bin/tsc', '--noEmit', '-p', 'tsconfig.json'],
  ['Lint', root, 'node_modules/eslint/bin/eslint.js', '.', '--ext', '.js,.jsx,.ts,.tsx', '--max-warnings', '0'],
  ['Backend regression tests', backend, 'node_modules/jest/bin/jest.js', '--runInBand'],
  ['Production frontend build', root, 'node_modules/vite/bin/vite.js', 'build'],
  ['Browser and responsive checks', root, 'node_modules/@playwright/test/cli.js', 'test']
];

const collect = (directory, sourceFiles) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory() && !['node_modules', '.git', '.pio', 'dist'].includes(entry.name)) collect(full, sourceFiles);
    else if (entry.isFile() && (/\.(?:ts|tsx|js|mjs|cjs|json|prisma|sql|yml|yaml|sh|ini|ino|h|cpp)$/.test(entry.name) || entry.name === 'Dockerfile')) sourceFiles.push(full);
  }
};
const fingerprint = () => {
  const sourceFiles = [];
  for (const directory of ['src', 'backend/src', 'backend/scripts', 'backend/tests', 'backend/prisma', 'e2e', 'scripts', 'load', 'firmware', '.github']) {
    const full = path.join(root, directory);
    if (fs.existsSync(full)) collect(full, sourceFiles);
  }
  for (const file of ['package.json', 'package-lock.json', 'backend/package.json', 'backend/package-lock.json', 'playwright.config.ts', '.eslintrc.cjs', 'tsconfig.json', 'tsconfig.node.json', 'backend/tsconfig.json', 'backend/tsconfig.test.json', 'backend/jest.config.cjs', 'vite.config.ts']) sourceFiles.push(path.join(root, file));
  for (const file of ['backend/Dockerfile', 'backend/.dockerignore', 'docker-compose.yml', 'render.yaml', 'security/vulnerability-exceptions.json']) sourceFiles.push(path.join(root, file));
  const hash = createHash('sha256');
  for (const file of sourceFiles.sort()) {
    hash.update(path.relative(root, file).replaceAll('\\', '/'));
    hash.update('\0');
    hash.update(fs.readFileSync(file));
    hash.update('\0');
  }
  return hash.digest('hex');
};

const report = {
  generatedAt: new Date().toISOString(),
  workspace: root,
  nodeVersion: process.version,
  sourceSha256: fingerprint(),
  scope: 'Local code checks only; does not attest deployed services, hardware or customer savings.',
  passed: false,
  checks: []
};

for (const [name, cwd, executable, ...args] of steps) {
  console.log(`\n${name}`);
  const start = Date.now();
  const result = spawnSync(process.execPath, [path.join(cwd, executable), ...args], {
    cwd,
    stdio: 'inherit',
    env: process.env,
    timeout: 10 * 60 * 1000
  });
  const passed = !result.error && result.status === 0;
  report.checks.push({ name, passed, exitCode: result.status, elapsedMs: Date.now() - start });
  if (!passed) break;
}
report.sourceUnchanged = report.sourceSha256 === fingerprint();
report.passed = report.sourceUnchanged && report.checks.length === steps.length && report.checks.every((step) => step.passed);
const output = path.join(root, 'go-live-reports', 'local-verification.json');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(`\n${report.passed ? 'PASS' : 'FAIL'}: local verification. Evidence: ${output}`);
process.exitCode = report.passed ? 0 : 1;
