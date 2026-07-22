# Backup / restore evidence log

One section per drill. **Never** paste connection strings with passwords.

## Drill template

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
| Application smoke-test results | `restore:verify` OK (full HTTP go-live smoke still pending against a backend pointed at this branch) |
| Authenticated HTTP smoke artifact / SHA-256 | _pending_ |
| Cross-tenant isolation result / artifact | _pending_ |
| Migration status artifact / SHA-256 | _pending_ |
| Restore target disposal time / evidence | _pending_ |
| Failures and corrections | None. Note: vault/edge-reliability migrations not yet on this DB (apply when promoting that release). History retention 6h — raise before pilot if multi-day PITR required. Branch TTL expires 2026-07-22T18:00:00Z. |
| Approver | _pending sign-off_ |
| Date | 2026-07-20 |

## History

| Date | Environment | RPO | RTO | Pass? | Approver |
|------|-------------|-----|-----|-------|----------|
| 2026-07-20 | Neon `gridflex` isolated branch `restore-drill-20260720` | branch clone / 6h window | ~1 min + 9s verify | yes (verify) | _pending_ |

## Follow-up verification — 2026-07-21

Read-only verification used isolated Neon branch
`restore-drill-20260720` (`br-dawn-shadow-afaej62i`), never the primary.

| Check | Result |
|-------|--------|
| Organisations / users / sites / nodes | 1 / 5 / 1 / 1 |
| Sensor / telemetry readings | 1 / 0 |
| Orphan site→organisation relations | 0 |
| Orphan node→site relations | 0 |
| Applied successful migrations | 12 |
| Latest applied migration | `20260719210000_pr5_alarms_incidents` |
| Current repository migrations deployed | **No — open** |
| Authenticated HTTP smoke | **Open** |
| Approver | **Open** |

This confirms the restored data and sampled tenant relationships are intact,
but it does **not** close the recovery gate. Deploy current migrations to the
isolated target, start the current backend against it, run authenticated
read-only API and cross-tenant smoke tests, record artifact hashes, and obtain
approval.

## Quarterly schedule

| Quarter | Planned | Completed | Notes |
|---------|---------|-----------|-------|
| 2026 Q3 | 2026-07-20 | 2026-07-20 (verify) | First automated drill; HTTP smoke + approver still open |
| 2026 Q4 | | | |
| 2027 Q1 | | | |
| 2027 Q2 | | | |
