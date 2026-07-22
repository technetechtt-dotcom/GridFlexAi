# Supply-chain security

## CI controls

| Control | Implementation |
|---------|----------------|
| npm audit (HIGH/CRITICAL production deps) | `security` job |
| Secrets hygiene (tracked files) | `npm run check:secrets-hygiene` in `security` job |
| Gitleaks | Docker CLI `zricethezav/gitleaks:v8.24.0` (OSS; no org license secret required) |
| Container image scan | Trivy — **fail-closed on fixed CRITICAL and HIGH**; SARIF retained and uploaded |
| SBOM | CycloneDX npm **pinned** `@cyclonedx/cyclonedx-npm@1.19.3` + Syft (image) |
| Dependabot | `.github/dependabot.yml` weekly PRs |
| CODEOWNERS | `.github/CODEOWNERS` for auth/vault/firmware/CI |
| Static analysis | CodeQL `javascript-typescript` with extended security queries |
| Workflow integrity | actionlint plus immutable full-SHA GitHub Action pins |
| Release integrity | GHCR digest, SPDX SBOM, GitHub OIDC attestations, and keyless Cosign signature |

## Vulnerability policy (must match CI)

| Severity | CI behaviour | Promotion |
|----------|--------------|-----------|
| CRITICAL (fixed) | Fail `supply-chain` / `security`; no exceptions | Block |
| HIGH (fixed) | Fail unless an approved, unexpired exception exists | Block without exception |
| Medium/Low | Report | Track |

Exception requirements and the 90-day maximum lifetime are defined in
`docs/policies/supply-chain-vulnerability-policy.md`. The machine-readable register is
`security/vulnerability-exceptions.json`.

CI and release evidence format, retention, and trust boundaries are documented in
`docs/runbooks/ci-evidence.md`.

## Local

```bash
cd backend && npm run check:secrets-hygiene
npm audit --omit=dev --audit-level=critical
```
