# GridFlex Production Readiness Tracker

Use this tracker to move from pilot-ready to production-ready with explicit ownership and evidence.

## Current Snapshot

- Estimated readiness: **70-80%** (pilot-ready, not fully production-hardened).
- Last updated: **2026-04-17**.

## P0 - Go-Live Blockers

- [x] **Backend/frontend build and type safety are green in CI**
  - Evidence: `.github/workflows/ci.yml` runs lint/typecheck/build/test.
- [x] **Public health route has automated API smoke coverage**
  - Evidence: `backend/tests/health.routes.test.ts`.
- [x] **Production env guardrails for unsafe placeholders**
  - Evidence: `backend/src/config/env.ts` now rejects weak/default production secrets and insecure CORS/admin HTTPS settings.
- [ ] **Secrets moved to managed secret store and rotated**
  - Required: rotate `JWT_SECRET`, `EDGE_INGEST_SHARED_SECRET`, API keys.
  - Evidence needed: runbook + rotation timestamp.
- [ ] **Backup and restore test completed**
  - Required: restore latest backup into staging and validate app starts and queries run.
  - Evidence needed: restore log + sign-off.
- [ ] **Centralized logging + alerting enabled**
  - Status: request-id structured logging now in app and error pipeline; alert wiring still pending in hosting platform.
  - Evidence: `backend/src/middleware/requestId.ts`, `backend/src/middleware/errorHandler.ts`, `backend/src/app.ts`.
  - Remaining: configure alert rules and notification routing in production monitoring stack.
- [ ] **Staging parity with production runtime config**
  - Required: same env model, TLS strategy, DB/Redis class, CORS shape.
  - Evidence needed: staging config diff/checklist.

## P1 - First Week Hardening

- [x] Add critical-path E2E tests (login, dashboard, forecast, dispatch, retry banners).
  - Evidence: `e2e/critical-path.spec.ts`, `playwright.config.ts`, `.github/workflows/ci.yml`.
- [x] Add API contract tests for high-traffic chart payloads.
  - Evidence: `backend/tests/readings.routes.contract.test.ts`.
- [ ] Define p95 latency SLO and run baseline load test.
  - Status: SLO budget and baseline runner added (`npm run baseline:load`), production execution evidence still required.
  - Evidence: `scripts/load-baseline.mjs`, `package.json`.
- [x] Add dependency vulnerability gating (`npm audit`/SCA policy).
  - Evidence: `.github/workflows/ci.yml` security job with critical audit thresholds.
- [x] Write incident runbooks (provider outage, DB outage, secret rotation).
  - Evidence: `docs/runbooks/provider-outage.md`, `docs/runbooks/db-outage.md`, `docs/runbooks/secret-rotation.md`, `docs/runbooks/release-rollback.md`.

## P2 - Scale & Enterprise Hardening

- [ ] Canary or blue/green deployments with auto rollback trigger.
  - Status: rollout/rollback runbook defined; platform implementation and validation still pending.
  - Evidence: `docs/runbooks/canary-blue-green-rollout.md`.
- [ ] Formal data retention/access review policy.
  - Status: policy drafted; approval workflow and enforcement evidence still pending.
  - Evidence: `docs/policies/data-retention-access-policy.md`.
- [ ] Routine failure drills for provider and cache outages.
  - Status: drill program documented; scheduled executions and postmortems still pending.
  - Evidence: `docs/runbooks/failure-drill-program.md`.
- [ ] Capacity forecasting and cost guardrails.
  - Status: guardrail thresholds and monthly loop documented; dashboard/budget alert wiring still pending.
  - Evidence: `docs/runbooks/capacity-cost-guardrails.md`.

## Suggested Execution Order

1. Finish remaining P0 checks (secrets, backup/restore, observability, staging parity).
2. Lock P1 test/quality gates in CI.
3. Complete P2 deployment and resilience maturity items.

## External Execution Guide

- Use `docs/runbooks/go-live-execution-playbook.md` as the step-by-step operator checklist for non-code P0 completion.
- Use `docs/runbooks/readiness-execution-checklist.md` for owner/evidence tracking across P0, P1, and P2.
- Use `docs/runbooks/operator-command-sheet.md` for copy/paste validation commands (`verify:go-live`, `verify:go-live:full`, `verify:go-live:staging`, `verify:go-live:production`, `verify:go-live:summary`, `check:env-parity`, `baseline:load`).
- Use `npm run env:templates` to regenerate `env-keys/staging.env.keys` and `env-keys/production.env.keys` from backend env schema before parity checks.
- Use `docs/runbooks/render-setup-checklist.md` when provisioning or validating Render environments.
