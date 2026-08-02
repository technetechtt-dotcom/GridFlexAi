# Platform unblock checklist (post RC-2026-07-23 / PR #84)

Software gates from PR #84 are on `main`. Remaining items need people, AWS, staging, or plant hardware.

## Merged on main (do not re-open)

| Gate | Evidence |
|------|----------|
| Production forbids `SIMULATION` | `ALLOW_SIMULATION_IN_PRODUCTION` + Render `PILOT_LIVE` |
| Redis fail-closed CI | `redis-chaos` job + Jest |
| Ingest quarantine / duplicate metrics | `/api/metrics` + `docs/INGEST_PROCESSING.md` |
| Alert ownership / dashboard / drain stubs | `docs/observability/*` |

## Operator unlock order

1. **AWS KMS (#45)** — blocked without CLI/keys on workstation and Render.
   - Follow `docs/runbooks/aws-kms-setup.md`
   - Dry-run: `node scripts/verify-kms-readiness.mjs` (writes `go-live-reports/kms-readiness.json`)
   - After Render env is set: `ROUND_TRIP=true node scripts/verify-kms-readiness.mjs`
2. **Staging deploy of signed RC digest** — `sha256:accf07fc…c718` from `docs/releases/RC-2026-07-23.md`
3. **Alert webhook fire-drill on Render** — `ALERT_WEBHOOK_*` + local `ALERT_FIRE_DRILL_ALLOW=true npm run drill:alert-webhook` (dispatcher Ready; Render deliver/ack Open)
4. **Load soak (#50)** — multi-VU k6 + Redis-under-traffic against staging
5. **Restore approver sign-off** — Neon restore drill already has smoke SHA; needs named approver
6. **Hardware / plant (#43–46)** — HIL, inverter, interlock (external)
7. **Pen-test (#47)** — sign `docs/pentest/authorization-and-scope.md`, pick vendor; API inventory + test-accounts brief Ready
8. **POPIA (#48)** — Information Officer signs policy + first row in `docs/policies/access-review-log.md`; run `EXPORT_ACCESS_REVIEW_ALLOW=true npm run export:access-review` for export SHA

## Safety (unchanged)

`PILOT_LOCK_PHYSICAL_EXECUTION=true` — no physical actuation until HIL + plant written approval.
