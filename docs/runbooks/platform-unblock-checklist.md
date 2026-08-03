# Platform unblock checklist (post RC-2026-07-23 / PR #84 / #87)

Software gates from PR #84 and governance prep from PR #87 are on `main`.
Remaining items need AWS, Render staging, people signatures, or plant hardware.

## Merged on main (do not re-open)

| Gate | Evidence |
|------|----------|
| Production forbids `SIMULATION` | `ALLOW_SIMULATION_IN_PRODUCTION` + Render `PILOT_LIVE` |
| Redis fail-closed CI | `redis-chaos` job + Jest |
| Ingest quarantine / duplicate metrics | `/api/metrics` + `docs/INGEST_PROCESSING.md` |
| Alert ownership / dashboard / drain stubs | `docs/observability/*` |
| Pen-test API inventory + test-accounts brief | PR #87 → `docs/pentest/*` |
| Access-review export script | PR #87 → `export-privileged-users.ts` (+ User field fix) |
| Hardened alert fire-drill script | PR #87 → `drill:alert-webhook` |
| Env parity requires alert/metrics keys | PR #87 → `check:env-parity` PASS `a8f7e560…158b` |
| Restore-drill named engineering approver | `@technetechtt-dotcom` on `backup-restore-evidence.md` (2026-08-03) |

## Operator unlock order (still blocked from this workstation)

1. **AWS KMS (#45)** — AWS CLI installed; **IAM credentials still missing**.
   - `aws configure` (or set `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION`)
   - Then: `BOOTSTRAP_AWS_KMS_ALLOW=true CREATE_IAM_ACCESS_KEY=true npm run bootstrap:aws-kms`
   - Copy Render env from the bootstrap report; delete the one-time access-key file
   - Redeploy; then `ROUND_TRIP=true npm run verify:kms-readiness`
2. **Staging deploy of signed RC digest** — Blueprint Node rebuild ≠ Cosign digest.
   - `docs/runbooks/staging-rc-digest-deploy.md` + `docs/runbooks/render-rc-image-blueprint.md`
   - Set `RELEASE_GIT_SHA` / `RELEASE_IMAGE_DIGEST` (live host already returns `release: null/null`)
   - After deploy: `npm run verify:staging-digest`
3. **Alert webhook fire-drill on Render** — set `ALERT_WEBHOOK_*` + `METRICS_SCRAPE_TOKEN`; ack from staging. Local drill already PASS. Live host metrics unauth→503 (token required).
4. **Load soak (#50)** — health multi-VU against live Render **Partial Done** (see evidence board). Still need signed ingest multi-VU + Redis-under-traffic (Docker engine not healthy locally).
5. **Staging→prod same-digest promotion (#49)** — fill remaining rows in `parity-promotion-evidence.md` after both smokes pass.
6. **Hardware / plant (#43–46)** — Waveshare GPIO sign-off, HIL-14…20, inverter E2E, plant PPC/relay/BMS attestation (external).
7. **Pen-test (#47)** — sign RoE, engage vendor, attach report (templates Ready).
8. **POPIA (#48)** — Information Officer signs policy + access-review #1 row. Export SHA `ac664b53…7d42` recorded (dev DB); re-run against staging before IO sign-off if required.

## Safety (unchanged)

`PILOT_LOCK_PHYSICAL_EXECUTION=true` — no physical actuation until HIL + plant written approval.
