# GridFlex Production Readiness Tracker

Use this tracker to move from pilot-ready to production-ready with explicit ownership and evidence.

## Current Snapshot

- Estimated readiness: **~85% engineering / pilot frameworks**; **ops evidence still required** for go-live.
- Last updated: **2026-07-20**.
- Pre-pilot gates (1–15): see `docs/PILOT_DEPLOYMENT.md` (frameworks landed on `feat/pentest-load-testing`).
- Ops remaining: [`docs/runbooks/ops-completion-pack.md`](./docs/runbooks/ops-completion-pack.md)

## P0 - Go-Live Blockers

- [x] **Backend/frontend build and type safety are green in CI**
  - Evidence: `.github/workflows/ci.yml` runs lint/typecheck/build/test.
- [x] **Public health route has automated API smoke coverage**
  - Evidence: `backend/tests/health.routes.test.ts`.
- [x] **Production env guardrails for unsafe placeholders**
  - Evidence: `backend/src/config/env.ts` + `PILOT_LOCK_PHYSICAL_EXECUTION`.
- [x] **Live dashboard no longer invents synthetic actual/demand/frequency**
  - Evidence: `Dashboard.tsx`, `RealTimeContext.tsx`, `OperatingModeBanner` UNKNOWN-on-failure.
- [x] **Verified read-only inverter map (SunSpec Model 103) wired**
  - Evidence: `gateway/maps/vendor/sunspec/model103/1.0.ts`; confirm base address on site.
- [x] **Critical supply-chain findings block CI**
  - Evidence: npm audit critical, Gitleaks, Trivy CRITICAL/HIGH exit 1, `check:secrets-hygiene` in CI.
- [x] **Alert webhook delivery path in code**
  - Evidence: `ALERT_WEBHOOK_*` + `alert-dispatcher.ts` (host must set URL).
- [ ] **Secrets moved to managed secret store and rotated** *(ops)*
  - Framework: vaulted GRIDFLEX-V1, `EDGE_ALLOW_LEGACY_SHARED_SECRET=false` default, `npm run rotate:devices`.
  - Evidence needed: inventory last-rotated dates + rotation log after cutover.
- [ ] **Backup and restore test completed** *(ops)*
  - Framework: `docs/runbooks/database-backup-restore.md`, `npm run restore:verify`.
  - Evidence needed: filled `docs/runbooks/backup-restore-evidence.md`.
- [ ] **Centralized logging + alerting enabled** *(ops)*
  - Framework: `docs/OBSERVABILITY.md`, Prometheus `/api/metrics`, alert catalog.
  - Remaining: host log drain + live alert routes + on-call fire-drill.
- [ ] **Staging parity with production runtime config** *(ops)*
  - Framework: `docs/ENVIRONMENT_PARITY.md`, `npm run check:env-parity` / `report:parity`.
  - Evidence needed: promote one image digest staging→prod and attach parity report.

## P1 - First Week Hardening

- [x] Add critical-path E2E tests (login, dashboard, forecast, dispatch, retry banners).
  - Evidence: `e2e/critical-path.spec.ts`, `playwright.config.ts`, `.github/workflows/ci.yml`.
- [x] Add API contract tests for high-traffic chart payloads.
  - Evidence: `backend/tests/readings.routes.contract.test.ts`.
- [ ] Define p95 latency SLO and run baseline load test. *(ops)*
  - Framework: `docs/LOAD_TESTING.md`, `load/k6/*`, `npm run baseline:load` / `load:socketio`.
  - Evidence needed: staging soak + `docs/load/evidence-worksheet.md`.
- [x] Add dependency vulnerability gating (`npm audit`/SCA policy).
  - Evidence: CI security job + Trivy fail-closed + Dependabot (`docs/SUPPLY_CHAIN.md`).
- [x] Write incident runbooks (provider outage, DB outage, secret rotation).
  - Evidence: `docs/runbooks/*`.

## P2 - Scale & Enterprise Hardening

- [ ] Canary or blue/green deployments with auto rollback trigger.
  - Status: rollout/rollback runbook defined; platform implementation still pending.
  - Evidence: `docs/runbooks/canary-blue-green-rollout.md`.
- [ ] Formal data retention/access review policy *(sign-off)*.
  - Framework: retention + POPIA + access-review log (`docs/policies/*`).
  - Remaining: Information Officer approval + first monthly review entry.
- [ ] Routine failure drills for provider and cache outages. *(ops)*
  - Evidence: `docs/runbooks/failure-drill-program.md` — schedule executions.
- [ ] Capacity forecasting and cost guardrails. *(ops)*
  - Framework: guardrails + `docs/load/capacity-cost-estimates.md`; wire budget alerts.

## External Execution Guide

- Pre-pilot gates: `docs/PILOT_DEPLOYMENT.md`
- **Ops sprint (Days 1–6):** `docs/runbooks/ops-execution-sprint.md`
- Operator playbook: `docs/runbooks/go-live-execution-playbook.md`
- Command sheet: `docs/runbooks/operator-command-sheet.md`
- Checklist: `docs/runbooks/readiness-execution-checklist.md`
