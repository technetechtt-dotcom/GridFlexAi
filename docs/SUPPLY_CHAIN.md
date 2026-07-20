# Supply-chain security (Phase 13)

## Controls in CI

| Control | Where | Policy |
|---------|-------|--------|
| npm audit (critical) | `.github/workflows/ci.yml` `security` job | Fail on critical production vulns |
| SBOM (CycloneDX) | Frontend + backend npm + container Syft | Artifacts uploaded |
| Secret scanning | Gitleaks | Fail on findings |
| Container scan | Trivy CRITICAL/HIGH | **Fail-closed** on CRITICAL/HIGH |
| Image digest | Recorded for promotion | See Phase 10 |
| Dependency updates | `.github/dependabot.yml` | Weekly PRs |

## Local / release checks

```bash
cd backend && npm run check:secrets-hygiene
npm audit --omit=dev --audit-level=critical
```

## Configuration

- `.gitleaks.toml` — allowlists for intentional test placeholders only
- Dependabot covers npm (root + backend) and GitHub Actions

## Remediation SLA

| Severity | Action |
|----------|--------|
| Critical in prod deps / image | Block merge; patch within 7 days |
| High | Patch or risk-accept with owner before pilot |
| Medium/Low | Backlog |

## Evidence

- CI run artifacts: SBOMs, Trivy SARIF, image digest
- Dependabot PR history
- This document + `docs/PILOT_DEPLOYMENT.md` gate 13
