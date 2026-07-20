# GridFlex Production Readiness Tracker

Use this tracker to move from pilot-ready to production-ready with explicit ownership and evidence.
Do **not** mark ops items complete without dated evidence artifacts.

## Current Snapshot

- Estimated readiness: **~70% code frameworks**; **ops / plant evidence still open** for go-live.
- Last updated: **2026-07-20**.
- Pre-pilot gates: `docs/PILOT_DEPLOYMENT.md`
- Ops remaining: [`docs/runbooks/ops-completion-pack.md`](./docs/runbooks/ops-completion-pack.md)

## P0 - Go-Live Blockers

- [x] **CI required jobs green on `main`**
  - Evidence: https://github.com/technetechtt-dotcom/GridFlexAi/actions/runs/29742474501 (`security`, `supply-chain`, `frontend`, `backend`).
  - Last verified: 2026-07-20 @ `0c6dfe6`.
- [x] **Public health route has automated API smoke coverage**
  - Evidence: `backend/tests/health.routes.test.ts`.
- [x] **Production env guardrails for unsafe placeholders**
  - Evidence: `backend/src/config/env.ts` + `PILOT_LOCK_PHYSICAL_EXECUTION`.
- [x] **Live dashboard does not invent synthetic actual/demand/frequency**
  - Evidence: `Dashboard.tsx`, `RealTimeContext.tsx`, `OperatingModeBanner` UNKNOWN-on-failure.
- [x] **Verified read-only SunSpec Model 103 map (dynamic SF; no false daily WH)**
  - Evidence: `gateway/maps/vendor/sunspec/model103/1.0.ts` + `sunspec-discovery.ts`.
  - Remaining on site: discovery of `PILOT_SUNSPEC_MODEL103_BASE` + HIL-20 scale check.
- [x] **Supply-chain controls in CI (audit / Gitleaks CLI / Trivy v0.36+)**
  - Evidence: `.github/workflows/ci.yml` (fail-closed on CRITICAL/HIGH when fixed vulns exist).
- [x] **Alert webhook delivery path in code**
  - Evidence: `ALERT_WEBHOOK_*` + `alert-dispatcher.ts` (host must set URL).
- [x] **AWS KMS client dependency present for vault provider**
  - Evidence: `backend/package.json` → `@aws-sdk/client-kms`.
- [x] **Atomic, body-hash-bound sequence advancement**
  - Evidence: `edgeDeviceAuth.ts` CAS `updateMany` + `lastAcceptedBodyHash`.
- [ ] **Secrets moved to managed secret store and rotated** *(ops)*
  - Evidence needed: inventory last-rotated dates + `docs/runbooks/secret-rotation-log.md`.
- [ ] **Backup and restore drill signed off** *(ops)*
  - Partial: `restore:verify` OK on `restore-drill-20260720`; approver + HTTP smoke still open.
- [ ] **Centralized logging + alerting live** *(ops)*
  - Remaining: log drain + `ALERT_WEBHOOK_URL` fire-drill row in `docs/observability/alert-review.md`.
- [ ] **Staging→prod image digest promotion evidence** *(ops)*
  - Evidence: `docs/runbooks/parity-promotion-evidence.md`.

## P1 - First Week Hardening

- [x] Critical-path E2E + API contract tests in repo.
- [ ] Formal staging load soak + evidence worksheet *(ops)* — `docs/load/evidence-worksheet.md`.
- [x] Dependency vulnerability gating in CI.
- [x] Incident runbooks present under `docs/runbooks/*`.

## P2 / External approvals

- [ ] Physical HIL bench matrix HIL-14…20 + plant signatures — `docs/equipment/hil-evidence-worksheet.md`.
- [ ] External penetration test engagement closed — `docs/PENETRATION_TEST.md`.
- [ ] POPIA Information Officer approval + access-review #1 — `docs/policies/*`.
- [ ] Plant-safety / physical-execution lock attestation — `docs/policies/pilot-physical-execution-lock.md`.

## External Execution Guide

- Ops sprint: `docs/runbooks/ops-execution-sprint.md`
- Completion pack: `docs/runbooks/ops-completion-pack.md`
- Command sheet: `docs/runbooks/operator-command-sheet.md`
