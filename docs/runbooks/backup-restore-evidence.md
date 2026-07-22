# Backup / restore evidence log

One section per drill. **Never** paste connection strings with passwords.

## Drill — 2026-07-22

| Field | Value |
|-------|-------|
| Backup identifier / PITR time / snapshot id | Neon branch `restore-drill-20260722` (`br-wandering-darkness-afxi8rj2`) forked from `main` (`br-nameless-cake-af451y8j`) |
| Environment / isolated restore target | Neon isolated branch (expires 2026-07-29T18:00:00Z) |
| Release commit / image digest | `d68ac65` (+ idempotent drift migration follow-up) |
| Backup time (UTC) | 2026-07-22T11:53:00Z (approx branch create) |
| Restore start (UTC) | 2026-07-22T11:53:00Z |
| Restore end (UTC) | 2026-07-22T11:56:04Z |
| Achieved RPO | Instant branch clone from primary (history window currently 6h on project) |
| Achieved RTO | ~1 min branch ready + migrate deploy ~20s + `restore:verify` ~9s |
| Record counts (orgs / users / nodes / readings) | orgs 1 / users 5 / edgeNodes 1 / sensorReadings ~30900 / telemetryReadings 0 |
| Integrity checks | `RESTORE_VERIFY_ALLOW=true npm run restore:verify` → OK after resolving failed drift migration |
| Application smoke-test results | `restore:verify` OK; authenticated HTTP smoke **passed** 2026-07-22 against loopback backend on restore branch |
| Authenticated HTTP smoke artifact / SHA-256 | `go-live-reports/restore-http-smoke.json` SHA-256 `57531f57502e6cfe0e7e8458fc36eb374ebe7196f631d9e0e8dd1ccf06edd4bb` |
| Cross-tenant isolation result / artifact | _pending_ |
| Migration status artifact / SHA-256 | Applied through `20260721110000_tenant_simulation_runs` on restore branch |
| Restore target disposal time / evidence | Auto-expire 2026-07-29T18:00:00Z (or delete earlier after approval) |
| Failures and corrections | Parent `main` had failed `20260721100000_schema_drift_reconciliation` (`BillingAccount` already exists). Made migration idempotent; `migrate resolve --rolled-back` then redeploy on restore + main. |
| Approver | _pending sign-off_ |
| Date | 2026-07-22 |

## Prior drill — 2026-07-20

| Field | Value |
|-------|-------|
| Backup identifier / PITR time / snapshot id | Neon branch `restore-drill-20260720` (`br-dawn-shadow-afaej62i`) forked from `main` (`br-nameless-cake-af451y8j`) |
| Environment / isolated restore target | Neon isolated branch |
| Release commit / image digest | _pending for HTTP smoke_ |
| Backup time (UTC) | 2026-07-20T11:35:00Z (approx branch create) |
| Restore start (UTC) | 2026-07-20T11:35:00Z |
| Restore end (UTC) | 2026-07-20T11:36:00Z |
| Achieved RPO | Instant branch clone from primary (history window currently 6h on project) |
| Achieved RTO | ~1 min to branch ready + `restore:verify` 9.1s |
| Record counts (orgs / users / nodes / readings) | orgs 1 / users 5 / edgeNodes 1 / sensorReadings 1 / telemetryReadings 0 |
| Integrity checks | `RESTORE_VERIFY_ALLOW=true npm run restore:verify` → OK; prisma migrations present through `20260719210000_pr5_alarms_incidents` |
| Application smoke-test results | `restore:verify` OK (full HTTP go-live smoke still pending) |
| Authenticated HTTP smoke artifact / SHA-256 | _pending_ |
| Cross-tenant isolation result / artifact | _pending_ |
| Migration status artifact / SHA-256 | _pending_ |
| Restore target disposal time / evidence | TTL expires 2026-07-22T18:00:00Z |
| Failures and corrections | None at time of drill. History retention 6h — raise before pilot if multi-day PITR required. |
| Approver | _pending sign-off_ |
| Date | 2026-07-20 |

## History

| Date | Environment | RPO | RTO | Pass? | Approver |
|------|-------------|-----|-----|-------|----------|
| 2026-07-22 | Neon `gridflex` isolated branch `restore-drill-20260722` | branch clone / 6h window | ~1 min + migrate + verify | yes (verify + migrations + HTTP smoke); **approver Open** | _pending_ |
| 2026-07-20 | Neon `gridflex` isolated branch `restore-drill-20260720` | branch clone / 6h window | ~1 min + 9s verify | yes (verify) | _pending_ |

## Quarterly schedule

| Quarter | Planned | Completed | Notes |
|---------|---------|-----------|-------|
| 2026 Q3 | 2026-07-20 | 2026-07-20 / 2026-07-22 (verify) | HTTP smoke + approver still open |
| 2026 Q4 | | | |
| 2027 Q1 | | | |
| 2027 Q2 | | | |
