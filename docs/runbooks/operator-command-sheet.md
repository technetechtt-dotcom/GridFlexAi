# GridFlex Operator Command Sheet

Use these commands to execute and collect evidence for remaining P0/P1/P2 platform tasks.

## P0 - Go-live blocker commands

## 1) Staging parity diff (env keys only)

Generate templates from backend env schema:

```bash
npm run env:templates
```

Populate exported platform keys (no values) into:

- `env-keys/staging.env.keys`
- `env-keys/production.env.keys`

Run:

```bash
npm run check:env-parity
```

Expected result: `Environment key parity check: PASS`

## 2) Go-live verification smoke

Basic (health + auth guard):

```bash
GO_LIVE_BASE_URL=https://<backend-domain> npm run verify:go-live
```

Full auth and critical endpoint checks:

```bash
GO_LIVE_BASE_URL=https://<backend-domain> GO_LIVE_EMAIL=<admin-email> GO_LIVE_PASSWORD=<admin-password> GO_LIVE_OUTPUT_FILE=go-live-verification.json npm run verify:go-live
```

Strict full verification (fails fast if required auth vars are missing):

```bash
GO_LIVE_BASE_URL=https://<backend-domain> GO_LIVE_EMAIL=<admin-email> GO_LIVE_PASSWORD=<admin-password> npm run verify:go-live:full
```

Staging full verification (writes `go-live-reports/staging-go-live-verification.json` by default):

```bash
STAGING_GO_LIVE_BASE_URL=https://<staging-backend-domain> STAGING_GO_LIVE_EMAIL=<admin-email> STAGING_GO_LIVE_PASSWORD=<admin-password> npm run verify:go-live:staging
```

Production full verification (writes `go-live-reports/production-go-live-verification.json` by default):

```bash
PRODUCTION_GO_LIVE_BASE_URL=https://<production-backend-domain> PRODUCTION_GO_LIVE_EMAIL=<admin-email> PRODUCTION_GO_LIVE_PASSWORD=<admin-password> npm run verify:go-live:production
```

Generate consolidated go/no-go markdown summary from staging + production reports:

```bash
npm run verify:go-live:summary
```

Default output: `go-live-reports/summary.md`

## 3) Backup/restore post-restore validation

After restoring to staging, run:

```bash
GO_LIVE_BASE_URL=https://<staging-backend-domain> GO_LIVE_EMAIL=<admin-email> GO_LIVE_PASSWORD=<admin-password> npm run verify:go-live
```

## P1 - Hardening commands

## 1) Baseline load SLO evidence

```bash
LOAD_BASE_URL=https://<backend-domain> LOAD_PATH=/api/health/live LOAD_REQUESTS=400 LOAD_CONCURRENCY=25 LOAD_P95_BUDGET_MS=500 npm run baseline:load
```

## 2) Frontend critical-path E2E

Install browser runtime once:

```bash
npm run e2e:install
```

Run suite:

```bash
npm run e2e
```

## P2 - Program commands and artifacts

- Rollout/rollback policy:
  - `docs/runbooks/canary-blue-green-rollout.md`
- Data retention/access policy:
  - `docs/policies/data-retention-access-policy.md`
- Failure drill program:
  - `docs/runbooks/failure-drill-program.md`
- Capacity/cost guardrails:
  - `docs/runbooks/capacity-cost-guardrails.md`

Use these documents as execution templates, then attach platform evidence links in `docs/runbooks/readiness-execution-checklist.md`.
