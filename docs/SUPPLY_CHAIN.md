# Supply-chain security

## CI controls

| Control | Implementation |
|---------|----------------|
| npm audit (critical production deps) | `security` job |
| Secrets hygiene (tracked files) | `npm run check:secrets-hygiene` in `security` job |
| Gitleaks | Docker CLI `zricethezav/gitleaks:v8.24.0` (OSS; no org license secret required) |
| Container image scan | `aquasecurity/trivy-action@v0.36.0` — **fail-closed on fixed CRITICAL**; HIGH reported in SARIF (does not fail CI until policy flip) |
| SBOM | CycloneDX npm **pinned** `@cyclonedx/cyclonedx-npm@1.19.3` + Syft (image) |
| Dependabot | `.github/dependabot.yml` weekly PRs |
| CODEOWNERS | `.github/CODEOWNERS` for auth/vault/firmware/CI |

## Vulnerability policy (must match CI)

| Severity | CI behaviour | Promotion |
|----------|--------------|-----------|
| CRITICAL (fixed) | Fail `supply-chain` / `security` | Block |
| HIGH (fixed) | Report SARIF; **do not fail** (current) | Manual review before prod |
| Medium/Low | Report | Track |

To fail-closed on HIGH, change Trivy `severity: 'CRITICAL,HIGH'` with `exit-code: "1"` and update this table in the same PR.

## Still open

- Pin GitHub Actions to immutable commit SHAs
- Cosign / provenance attestations on promoted images
- Formal vulnerability exception register with owners + expiry

## Local

```bash
cd backend && npm run check:secrets-hygiene
npm audit --omit=dev --audit-level=critical
```
