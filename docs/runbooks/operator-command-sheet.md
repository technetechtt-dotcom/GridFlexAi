# GridFlex Operator Command Sheet

Use these commands to execute and collect evidence for remaining P0/P1/P2 platform tasks.

**Sequenced ops sprint:** [`ops-execution-sprint.md`](./ops-execution-sprint.md)

## P0 - Go-live blocker commands

## 0) Secrets hygiene (pre-rotation)

```bash
cd backend
npm run check:secrets-hygiene
```

Generate JWT overlapping-kid env snippet (stdout only — do not commit):

```bash
npm run secrets:jwt-rotation-snippet
# or:
node scripts/generate-jwt-rotation-snippet.mjs --from-kid legacy --to-kid v2 --previous-secret "<CURRENT_JWT_SECRET>"
```

Day 1 checklist: [`day1-jwt-rotation-checklist.md`](./day1-jwt-rotation-checklist.md)

## 0b) AWS KMS device vault (Render)

```text
DEVICE_SECRET_VAULT_PROVIDER=aws_kms
AWS_KMS_KEY_ID=<arn or key id>
AWS_REGION=<region>
AWS_ACCESS_KEY_ID=<iam>
AWS_SECRET_ACCESS_KEY=<iam>
```

Full steps: [`aws-kms-setup.md`](./aws-kms-setup.md)

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

## 3) Backup/restore validation

Against the **isolated restore** database URL only:

```bash
cd backend
RESTORE_VERIFY_ALLOW=true DATABASE_URL="postgresql://…restore-branch…" npm run restore:verify
```

Then smoke the app pointed at that restore (never production primary):

```bash
GO_LIVE_BASE_URL=https://<staging-or-restore-backend> GO_LIVE_EMAIL=<admin-email> GO_LIVE_PASSWORD=<admin-password> npm run verify:go-live
```

Evidence: [`backup-restore-evidence.md`](./backup-restore-evidence.md)

## 4) Signed parity report (after digest promotion)

```bash
npm run check:env-parity
IMAGE_DIGEST=sha256:<digest> STAGING_SMOKE_RESULT=pass PRODUCTION_SMOKE_RESULT=pass npm run report:parity
```

Evidence: [`parity-promotion-evidence.md`](./parity-promotion-evidence.md)

## 5) Metrics scrape proof

```bash
curl -sH "Authorization: Bearer $METRICS_SCRAPE_TOKEN" https://<backend-domain>/api/metrics
```

## P1 - Hardening commands

## 1) Baseline load SLO evidence

```bash
LOAD_BASE_URL=https://<backend-domain> LOAD_PATH=/api/health/live LOAD_REQUESTS=400 LOAD_CONCURRENCY=25 LOAD_P95_BUDGET_MS=500 npm run baseline:load
```

## 1b) k6 smoke / soak + Socket.IO fan-out

```bash
npm run load:k6:smoke
# Formal soak: follow docs/LOAD_TESTING.md against staging
npm run load:socketio
```

Evidence: [`../load/evidence-worksheet.md`](../load/evidence-worksheet.md)

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
