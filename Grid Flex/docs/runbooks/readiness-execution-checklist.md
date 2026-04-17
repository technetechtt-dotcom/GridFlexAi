# GridFlex Readiness Execution Checklist (P0, P1, P2)

Use this as the single checklist to drive completion evidence across engineering and operations.

## How to use this checklist

- Assign an owner and due date to each unchecked item.
- Capture evidence links immediately after completion (screenshots, logs, dashboard URLs, CI links).
- Do not mark items complete without evidence.
- Use `docs/runbooks/operator-command-sheet.md` for copy/paste execution commands.

## P0 - Go-live blockers

- [ ] Secrets moved to managed secret store and rotated
  - Owner:
  - Due:
  - Steps:
    - rotate `JWT_SECRET`, `EDGE_INGEST_SHARED_SECRET`, provider keys
    - deploy staging -> run smoke tests -> promote to production
  - Evidence:
    - rotation timestamp:
    - smoke test output:
  - Suggested command after deployment:
    - `PRODUCTION_GO_LIVE_BASE_URL=https://<production-backend-domain> PRODUCTION_GO_LIVE_EMAIL=<admin-email> PRODUCTION_GO_LIVE_PASSWORD=<admin-password> npm run verify:go-live:production`
- [ ] Backup + restore drill completed
  - Owner:
  - Due:
  - Steps:
    - create on-demand backup
    - restore into staging instance
    - validate `/api/health`, `/api/readings`, `/api/forecast`
  - Evidence:
    - restore duration (RTO):
    - recovery point (RPO):
  - Suggested post-restore command:
    - `STAGING_GO_LIVE_BASE_URL=https://<staging-backend-domain> STAGING_GO_LIVE_EMAIL=<admin-email> STAGING_GO_LIVE_PASSWORD=<admin-password> npm run verify:go-live:staging`

- [ ] Final go/no-go summary artifact generated
  - Owner:
  - Due:
  - Evidence:
    - summary file: `go-live-reports/summary.md`
  - Suggested command:
    - `npm run verify:go-live:summary`
- [ ] Alerting and monitoring routing verified
  - Owner:
  - Due:
  - Minimum alerts:
    - `/api/health/live` failure
    - `/api/health` dependency failure
    - 5xx error-rate spike
    - forecast provider degradation
  - Evidence:
    - test alert event IDs:
    - on-call acknowledgement screenshot/link:
- [ ] Staging parity with production validated
  - Owner:
  - Due:
  - Steps:
    - export staging/prod key lists (keys only)
    - diff and close gaps
    - validate TLS/CORS/runtime parity
  - Evidence:
    - parity diff file:
    - sign-off:
  - Suggested command:
    - `npm run env:templates`
    - `npm run check:env-parity`

## P1 - First-week hardening

- [x] Critical-path E2E tests enabled (frontend + backend integration)
  - Scope covered:
    - login
    - dashboard load
    - forecast navigation path
    - dispatch flow
    - retry banner handling
  - Evidence:
    - `e2e/critical-path.spec.ts`
    - `playwright.config.ts`
    - `.github/workflows/ci.yml` frontend job step (`npm run e2e`)
- [x] API contract tests for high-traffic chart payloads
  - Evidence: `backend/tests/readings.routes.contract.test.ts`
- [ ] p95 latency SLO baseline measured and recorded
  - Owner:
  - Due:
  - SLO target: p95 <= 500ms for core read endpoints under normal load
  - Run command:
    - `LOAD_BASE_URL=https://<backend-domain> LOAD_PATH=/api/health/live LOAD_REQUESTS=400 LOAD_CONCURRENCY=25 LOAD_P95_BUDGET_MS=500 npm run baseline:load`
  - Evidence:
    - command output:
    - dashboard snapshot:
  - Suggested command:
    - `LOAD_BASE_URL=https://<backend-domain> LOAD_PATH=/api/health/live LOAD_REQUESTS=400 LOAD_CONCURRENCY=25 LOAD_P95_BUDGET_MS=500 npm run baseline:load`

## P2 - Scale and enterprise hardening

- [ ] Canary or blue/green deployment with auto rollback
  - Owner:
  - Due:
  - Evidence:
    - rollout policy link: `docs/runbooks/canary-blue-green-rollout.md`
    - rollback trigger proof:
- [ ] Formal data retention and access review policy
  - Owner:
  - Due:
  - Evidence:
    - policy doc link: `docs/policies/data-retention-access-policy.md`
    - approval record:
- [ ] Routine failure drills (provider outage, cache outage)
  - Owner:
  - Due:
  - Evidence:
    - drill run logs: `docs/runbooks/failure-drill-program.md`
    - postmortem links:
- [ ] Capacity forecasting and cost guardrails
  - Owner:
  - Due:
  - Evidence:
    - capacity model sheet: `docs/runbooks/capacity-cost-guardrails.md`
    - budget alert rules:

## Suggested 48-hour sprint

## Day 1

- Finish all P0 items except backup restore.
- Execute initial p95 baseline and record evidence.
- Open P2 tasks and assign owners.

## Day 2

- Run and document backup/restore drill.
- Enable or scope E2E harness.
- Confirm P0 sign-off and publish go/no-go note.
