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

1. **AWS KMS (#45)** — blocked: no AWS CLI / IAM credentials; `verify-kms-readiness` reports 5 blockers.
   - Follow `docs/runbooks/aws-kms-setup.md`
   - Dry-run: `node scripts/verify-kms-readiness.mjs`
   - After Render env is set: `ROUND_TRIP=true node scripts/verify-kms-readiness.mjs`
2. **Staging deploy of signed RC digest** — pin Render to `sha256:accf07fc…c718` (`docs/releases/RC-2026-07-23.md`). No Render CLI/credentials on workstation.
3. **Alert webhook fire-drill on Render** — set `ALERT_WEBHOOK_*` + `METRICS_SCRAPE_TOKEN`; ack from staging. Local drill already PASS.
4. **Load soak (#50)** — multi-VU k6 + Redis-under-traffic against staging (needs staging URL + Docker for local Redis chaos).
5. **Staging→prod same-digest promotion (#49)** — fill remaining rows in `parity-promotion-evidence.md` after both smokes pass.
6. **Hardware / plant (#43–46)** — Waveshare GPIO sign-off, HIL-14…20, inverter E2E, plant PPC/relay/BMS attestation (external).
7. **Pen-test (#47)** — sign RoE, engage vendor, attach report (templates Ready).
8. **POPIA (#48)** — Information Officer signs policy + access-review #1 row. Export SHA `ac664b53…7d42` recorded (dev DB); re-run against staging before IO sign-off if required.

## Safety (unchanged)

`PILOT_LOCK_PHYSICAL_EXECUTION=true` — no physical actuation until HIL + plant written approval.
