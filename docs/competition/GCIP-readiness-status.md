# GCIP / production readiness status

| Area | Status | Notes |
|------|--------|-------|
| Release identity (staging) | Temporary | Source-built `gridflex-backend` may set `REQUIRE_RELEASE_IDENTITY=false` |
| Release identity (production) | Required | `gridflex-backend-prod` digest-pinned Docker, Cosign verify, `REQUIRE_RELEASE_IDENTITY=true` |
| Deployment records | Done | `DeploymentRecord` written on boot (SHA, digest, migration, time) |
| Login wording | Done | No military-grade claim; invite-only messaging |
| Operator decisions | Done | PostgreSQL `OperatorDecision` |
| Recovery cases | Done | PostgreSQL `RecoveryCaseRecord` |
| Alarm management | Done | Rules, thresholds, destinations, ack, assign, escalate, resolve, reopen, history, create task |
| Work orders | Done | Assign, priority, due, evidence, escalate overdue, complete, approve/reject |
| Pilot onboarding | Done | 9-step Postgres workflow including physical-execution lock |
| Data quality | Done | Exception types + resolution/approval history in Postgres |
| Pilot results + PDF | Done | Metrics page + GCIP print/PDF export with provenance |
| Navigation IA | Done | Overview / Monitor / Operate / Analyse / Administration; GCIP in presentation mode |
| Account workflow | Partial | Invite create/resend/revoke, sessions, logout-all, suspend, force password reset, MFA ack; self-serve email reset still admin-mediated |
| Responsive | In progress | Shared CSS helpers + alarm/work-order/onboarding/DQ forms touch-sized |
| Lint / Playwright / pen-test | Remaining | Run `npm run lint`, `npm run e2e:install && npm run e2e`, route smoke `npm run test:routes` |

## Production deploy gate

See `docs/runbooks/production-digest-deploy.md` and `npm run verify:cosign-image`.
