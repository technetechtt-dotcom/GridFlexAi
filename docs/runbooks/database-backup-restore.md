# Database backup and restoration (Phase 8)

## Objectives (initial pilot targets)

| Objective | Target | Notes |
|-----------|--------|-------|
| **RPO** | **15 minutes** | Neon history window / PITR granularity; tighten if contract requires |
| **RTO** | **2 hours** | Isolated restore branch + app smoke + sign-off |
| Retention | Per Neon plan history window (up to plan max) + optional nightly `pg_dump` to separate S3 account | |
| Cadence | Automated continuous history + **quarterly** restore drill | |

Adjust RPO/RTO only with written pilot/ops agreement; update this doc when changed.

## Automated backups (Neon)

Preferred stack for GridFlex Postgres:

1. **Instant restore / PITR** — set Neon [history window](https://neon.com/docs/introduction/history-window) appropriate to the pilot (encrypted, provider-managed). See [Backups overview](https://neon.com/docs/manage/backups) and [Instant restore](https://neon.com/docs/introduction/branch-restore).
2. **Optional nightly `pg_dump` → S3** (separate AWS account where practical) — [Neon S3 backup guides](https://neon.com/docs/manage/backups-aws-s3-backup-part-1).
3. Snapshots via Neon CLI (`neon snapshots`) for named recovery points when rehearsing.

Never rely on developer laptop dumps as the only backup.

### GridFlex project (ops)

| Field | Value |
|-------|-------|
| Neon project | `gridflex` |
| Project id | `odd-truth-63844972` |
| Region | `aws-us-west-2` |
| Primary branch | `main` (`br-nameless-cake-af451y8j`) |
| History retention (as of 2026-07-20) | **6 hours** (`21600s`) — raise toward plan max before pilot if multi-day PITR is required |
| Example restore branch | `restore-drill-YYYYMMDD` (TTL recommended; never restore over `main`) |

## Recovery rule

**Never restore over the production primary.** Always create an **isolated** restoration environment (Neon branch / separate project), use **separate credentials**, and restrict network access.

## Restore drill procedure

1. Record production backup identifier / PITR timestamp (or snapshot id).
2. Create isolated restore target:
   - Neon: restore/create branch from PITR or snapshot into a non-prod branch/project.
3. Issue a **new** database role/password for the restore target only.
4. Point a staging backend at `DATABASE_URL` for the restore branch (do not change production env).
5. Run:
   ```bash
   cd backend
   npx prisma migrate status
   npm run restore:verify
   ```
6. Start backend against restored DB; verify:
   - organisations, users, nodes, readings row counts
   - recent `SensorReading` / `TelemetryReading` timestamps
   - login + critical **read-only** APIs
   - tenant isolation (site-scoped queries do not leak)
7. Record evidence in [`backup-restore-evidence.md`](./backup-restore-evidence.md).
8. Delete or retain the restoration branch per data-retention policy.

## Application smoke (restore:verify)

`backend/scripts/restore-verify.ts` checks connectivity, migration presence, core table counts, and freshness of recent readings. It refuses to run if `RESTORE_VERIFY_ALLOW=true` is not set (guard against accidental prod use).

```bash
RESTORE_VERIFY_ALLOW=true DATABASE_URL="postgresql://…restore-branch…" npm run restore:verify
```

## Quarterly cadence

Schedule restore drills at least **once per quarter**. Track dates in the evidence log.

## Acceptance

| Criterion | Evidence |
|-----------|----------|
| Backup restores successfully | Neon branch/snapshot + evidence row |
| App starts against restored DB | Backend health + migrate status |
| Critical records + tenant relationships intact | `restore:verify` + manual tenant check |
| Measured RPO/RTO meet target | Evidence worksheet |
| Repeated quarterly | Evidence log dates |
