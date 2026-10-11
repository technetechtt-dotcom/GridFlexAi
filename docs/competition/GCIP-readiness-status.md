# GCIP competition readiness status

Updated: 2026-10-12 — production-readiness sprint (`feat/production-readiness-sprint`)

## Done in repo

| Item | Status | Evidence |
|------|--------|----------|
| Release identity fail-closed | Done | Production requires `RELEASE_GIT_SHA` + `RELEASE_IMAGE_DIGEST`; `/api/health` returns 503 when identity required but missing; admin system-status page |
| Login wording | Done | Removed “military-grade encryption”; invite-only messaging |
| Invite-only registration | Done | `INVITE_ONLY_REGISTRATION` (default on in production) |
| Operator decisions in Postgres | Done | `OperatorDecision` table + audit mirror |
| Recovery cases in Postgres | Done | `RecoveryCaseRecord` API `/recovery-cases` |
| Work orders | Done | `WorkOrder` API `/work-orders` + Operator Tasks page |
| Alarm workflow | Done | Create/edit rules, ack, clear with resolution note, history |
| Placeholder routes completed | Done | Pilot onboarding, data quality, work orders, verified impact |
| Pilot provenance report | Done | Downloadable HTML report with measured/simulated/estimated labels |
| Navigation IA | Done | Overview / Monitor / Operate / Analyse / Administration; GCIP behind demo mode |
| Role filtering | Done | Ops Center / team links role-gated; release page admin-only |

## Still blocked externally

| Item | Blocker | Next operator action |
|------|---------|----------------------|
| Live digest-pinned deploy | Render must set release env vars and promote signed digest | Set `RELEASE_GIT_SHA` + `RELEASE_IMAGE_DIGEST=sha256:4684d1fa…16fac`; redeploy image (not source rebuild); confirm `/api/health` is 200 with non-null release |
| Public frontend refresh | Live login still showed old wording until this build is published | Deploy latest frontend static build |
| Apply Prisma migration | `20261012100000_operator_decisions_recovery_cases` | `prisma migrate deploy` on staging/prod |
| Full mobile polish | Older dense pages | Manual pass at 360/390/768/1024/1440 |

## Honesty rules

1. Synthetic / demo results are never customer results.
2. Physical execution stays locked for the pilot.
3. Null release identity means source-built — say so.
4. Estimated carbon and clear-sky baselines stay labelled estimated.
