# Staging / production parity (Phase 10)

## Parity matrix

| Category | Staging | Production |
|----------|---------|------------|
| Node version | Same major/minor | Same major/minor |
| Container image | Digest under test | **Same digest** (promote, do not rebuild) |
| Database engine | Postgres major N | Postgres major N |
| Redis | Major N | Major N |
| Environment keys | Same schema (`env-keys/*.env.keys`) | Same schema |
| TLS/proxy | Equivalent | Enabled |
| Migrations | Same Prisma set | Same set |
| Feature flags | Documented diffs only | Approved (see report) |
| Monitoring | Same instrumentation | Live alert routing |
| Operating mode | HIL / SIMULATION | PILOT_LIVE / PRODUCTION_ADVISORY |

## Immutable image promotion

1. Build once in CI: `docker build -t gridflex-backend:$SHA .`
2. Push and record digest: `IMAGE_DIGEST=sha256:…`
3. Deploy **that digest** to staging → smoke → promote **same digest** to production.
4. Never `docker build` separately for production.

CI captures digest artifact when Docker build runs (see `.github/workflows/ci.yml`).

## Automate key comparison

```bash
npm run check:env-parity
```

Checks: missing/extra keys, required shared keys, unsafe production template values (`PHYSICAL_COMMAND_EXECUTION_ENABLED=false`, vault ≠ `local`, legacy edge auth off). Compares **key names**, not secret values. Writes `go-live-reports/env-parity.json`.

Optional live file (never commit): `PRODUCTION_ENV_FILE=/secure/path.env npm run check:env-parity`

## Signed parity report

```bash
npm run check:env-parity
IMAGE_DIGEST=sha256:… STAGING_SMOKE_RESULT=pass PRODUCTION_SMOKE_RESULT=pass \
  npm run report:parity
```

Outputs `go-live-reports/parity-report-latest.json` plus `.sha256` (or `.sig` if `PARITY_REPORT_SIGNING_PRIVATE_KEY_PEM` is set).

Fields: commit SHA, image digest, migration version, environment schema hash, smoke/verifier results, approved differences.

## Acceptance

| Criterion | Evidence |
|-----------|----------|
| Prod uses exact tested image | Matching `imageDigest` in parity report |
| DB/Redis majors match | Matrix + provider console |
| No undocumented config diffs | `check:env-parity` PASS |
| Go-live verify both envs | `verify:go-live:staging` / `:production` |
