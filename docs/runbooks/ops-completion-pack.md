# Ops completion pack — remaining external gates

This pack tracks work that **cannot be finished in code alone**. Engineering deliverables for the same themes are in-repo; mark rows only with evidence.

## Credential rotation (post device-auth cutover)

1. Deploy vaulted GRIDFLEX-V1 + `EDGE_ALLOW_LEGACY_SHARED_SECRET=false`.
2. Dry-run: `cd backend && npx tsx scripts/rotate-all-device-credentials.ts --dry-run`
3. Execute (staging first): `ROTATE_DEVICES_ALLOW=true npx tsx scripts/rotate-all-device-credentials.ts --execute`
4. Flash each `oneShotSecret` into `firmware/GridFlexEdge/config.h` (or secure element).
5. Follow [`secret-rotation.md`](./secret-rotation.md) for JWT, DB, Redis, provider keys, metrics token.
6. Log every secret in [`secret-rotation-log.md`](./secret-rotation-log.md); update [`../SECRETS_INVENTORY.md`](../SECRETS_INVENTORY.md).

| Secret class | Done? | Evidence |
|--------------|-------|----------|
| All device credentials re-provisioned | | rotation script output (redacted) |
| JWT kid overlap rotation | | rotation log |
| DATABASE_URL / REDIS_URL | | rotation log |
| Provider API keys | | rotation log |
| METRICS_SCRAPE_TOKEN / ALERT_WEBHOOK_TOKEN | | rotation log |
| Legacy shared secret removed | | env parity |

## Centralized monitoring + alert delivery

1. Wire host log drain to Better Stack / Datadog / CloudWatch.
2. Scrape `GET /api/metrics` with `METRICS_SCRAPE_TOKEN`.
3. Set `ALERT_WEBHOOK_ENABLED=true` + `ALERT_WEBHOOK_URL` (Slack/PagerDuty compatible JSON POST).
4. Fire-drill: invalid edge signature → webhook + on-call ack → [`../observability/alert-review.md`](../observability/alert-review.md).

| Check | Done? | Evidence |
|-------|-------|----------|
| Log drain live | | sample `traceId` URL |
| Metrics scrape | | `gridflex_` series |
| Webhook delivery | | alert-review fire-drill row |

## Database restoration

Already partially evidenced (`restore-drill-20260720`). Remaining:

| Check | Done? | Evidence |
|-------|-------|----------|
| Approver sign-off | | [`backup-restore-evidence.md`](./backup-restore-evidence.md) |
| HTTP smoke against restore branch | | go-live JSON |
| Raise Neon history retention | | console screenshot |

## Load tests

```bash
npm run baseline:load
npm run load:k6:smoke   # requires k6 on PATH
# Signed ingest: node load/sign-gridflex-v1.mjs ... then k6 with precomputed headers
npm run load:socketio
```

Fill [`../load/evidence-worksheet.md`](../load/evidence-worksheet.md).

## HIL full matrix (on bench)

CI covers packet cases HIL-01… (host). Complete hardware rows in [`../equipment/hil-evidence-worksheet.md`](../equipment/hil-evidence-worksheet.md) — especially HIL-14…20 (LTE, power loss, Redis/DB outage, clock, register scale).

## External penetration test

1. Sign [`../pentest/authorization-and-scope.md`](../pentest/authorization-and-scope.md) + RoE.
2. Engage independent tester ([`../PENETRATION_TEST.md`](../PENETRATION_TEST.md)).
3. Remediate critical/high; retest; file report in vault; update tracker.

| Milestone | Done? | Date |
|-----------|-------|------|
| SOW / RoE signed | | |
| Engagement complete | | |
| Critical/high closed | | |
| Retest pass | | |

## Physical HIL / load / monitoring / pen-test / POPIA

These **cannot** be completed in software alone. Track evidence here:

| Gate | Status | Artifact |
|------|--------|----------|
| Physical HIL HIL-14…20 | Open | `docs/equipment/hil-evidence-worksheet.md` |
| Staging load soak | Open | `docs/load/evidence-worksheet.md` |
| Monitoring fire-drill | Open | `docs/observability/alert-review.md` |
| External pen-test | Open | `docs/PENETRATION_TEST.md` + vault report |
| POPIA IO approval | Open | `docs/policies/popia-data-handling-policy.md` |
| Plant-safety attestation | Open | `docs/policies/pilot-physical-execution-lock.md` |

Do not check these complete in `PRODUCTION_READINESS.md` without signatures/dates.
