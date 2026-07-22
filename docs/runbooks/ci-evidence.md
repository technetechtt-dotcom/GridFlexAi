# CI and release evidence

CI uploads evidence with explicit retention:

- frontend and backend test/build logs: 30 days;
- migration logs, security audit logs, SBOMs, and scan output: 30–90 days;
- both ESP32-S3 target binaries, SHA-256 checksums, and build metadata: 90 days;
- consolidated commit-bound CI manifest: 90 days;
- registry release evidence, SBOM, digest, and manifest: 365 days.

The final CI job downloads every available `*-evidence` artifact and records the outcome of every
required job. `scripts/generate-ci-evidence-manifest.mjs` hashes each file and binds the manifest to
the full Git commit SHA. A failed job remains a failed outcome; the manifest does not convert missing
or failed evidence into a pass.

The release workflow publishes `backend/Dockerfile` to GHCR under a commit tag, generates an SPDX
SBOM, creates GitHub build and SBOM attestations, and keyless-signs the immutable image digest with
Cosign. It uses only the workflow-scoped `GITHUB_TOKEN` and GitHub OIDC; no long-lived registry or
signing secret is required.

Parity reports are deliberately separate from ordinary CI. Generate one only after staging and
production smoke checks have explicit `pass` or `fail` outcomes:

```bash
GIT_COMMIT_SHA=<40-hex-commit> \
IMAGE_DIGEST=sha256:<64-hex-registry-digest> \
STAGING_SMOKE_RESULT=pass \
PRODUCTION_SMOKE_RESULT=pass \
npm run report:parity
```

The report generator rejects tags, local Docker image IDs, commit SHAs used as image digests,
`pending`, and omitted smoke outcomes.

GitHub Actions are pinned to full upstream commit SHAs. The adjacent version comments are update
hints only. The pins were resolved from the official upstream repositories on 2026-07-21; Dependabot
may propose reviewed pin updates.
