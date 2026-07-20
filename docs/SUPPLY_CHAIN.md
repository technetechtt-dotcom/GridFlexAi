# Supply-chain security

## CI controls

| Control | Implementation |
|---------|----------------|
| npm audit (critical production deps) | `security` job |
| Secrets hygiene (tracked files) | `npm run check:secrets-hygiene` in `security` job |
| Gitleaks | Docker CLI `zricethezav/gitleaks:v8.24.0` (OSS; no org license secret required) |
| Container image scan | `aquasecurity/trivy-action@v0.36.0` — fail-closed on **fixed** CRITICAL/HIGH |
| SBOM | CycloneDX (npm) + Syft (image) uploaded as artifacts |
| Dependabot | `.github/dependabot.yml` weekly PRs |

## Local

```bash
cd backend && npm run check:secrets-hygiene
npm audit --omit=dev --audit-level=critical
```

## Notes

- Trivy uses `ignore-unfixed: true` so only remediable HIGH/CRITICAL fail the build.
- SARIF upload is best-effort (`continue-on-error`) when GitHub code scanning is not enabled.
- Backend image builds with `node:20-alpine` to match CI Node 20.
