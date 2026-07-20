# GridFlex Go-Live Execution Playbook

This playbook covers the remaining production tasks that cannot be completed purely in code.
For full P0/P1/P2 owner tracking, use `docs/runbooks/readiness-execution-checklist.md`.
For a **day-by-day ops sprint** with exit checkboxes, use [`ops-execution-sprint.md`](./ops-execution-sprint.md).

## Scope

Complete these four tracks in order:

1. Secret manager migration + rotation
2. Alerting and monitoring wiring
3. Backup + restore drill
4. Staging parity validation and sign-off

---

## 1) Secret Manager Migration + Rotation (P0)

### Target secrets

- `JWT_SECRET`
- `EDGE_INGEST_SHARED_SECRET`
- `DATABASE_URL`
- `REDIS_URL`
- `OPENWEATHER_API_KEY`
- `ACCUWEATHER_API_KEY`
- `OPENAI_API_KEY`

### Steps

1. Generate strong replacement values (32+ chars for JWT and edge secret).
2. Add secrets to your platform secret store (do not commit to `.env`).
3. Deploy to staging with new secrets.
4. Run smoke checks:
   - `GET /api/health/live`
   - `GET /api/health`
   - login/refresh/logout flow
   - forecast endpoints and provider status endpoints
   - edge ingestion validation
5. Promote the same secret set to production.
6. Redeploy production backend.
7. Run smoke checks again in production.

### Exit criteria

- Auth works end-to-end in staging and production.
- Forecast providers authenticate successfully.
- No spike in auth or edge-ingest `401` errors after rollout.

---

## 2) Alerting + Monitoring Wiring (P0)

### Minimum alert rules

- API liveness down (`/api/health/live` failing)
- Dependency health down (`/api/health` failing or `dependencies.redis=down` unexpectedly)
- HTTP 5xx error rate spike
- Forecast provider degradation
- DB connectivity failures

### Steps

1. Connect backend logs to centralized logging (Datadog, CloudWatch, Logtail, etc.).
2. Create dashboards for:
   - request volume
   - p95 latency
   - 4xx/5xx rates
   - provider fallback/degraded status
3. Configure alert routing (Slack + PagerDuty/email fallback).
4. Fire test alerts intentionally and confirm delivery/escalation.

### Exit criteria

- All alert routes confirmed with test events.
- On-call contact receives and acknowledges test incident.

---

## 3) Backup + Restore Drill (P0)

### Steps

1. Verify automated backup policy in managed Postgres.
2. Trigger an on-demand backup snapshot.
3. Restore into staging (or isolated restore instance).
4. Point staging backend to restored DB URL.
5. Validate:
   - backend boot succeeds
   - migrations are consistent
   - key read paths work (`/api/health`, `/api/readings`, `/api/forecast`)
6. Record actual restore time and data recovery point.

### Exit criteria

- Successful restore validated in staging.
- RTO/RPO recorded and approved.

---

## 4) Staging Parity Validation (P0)

### Parity checklist

- Same Node runtime major version
- Same backend/image build command and start command
- Same TLS/HTTPS behavior
- Same CORS policy structure
- Same DB/Redis classes (or closest equivalent)
- Same env keys populated (values may differ, key set must match)

### Steps

1. Export staging and production env key lists (keys only, no secret values).
2. Diff the key sets and close gaps.
3. Validate deployed health endpoints in staging and production.
4. Run UI smoke pass against staging frontend + staging backend.

### Exit criteria

- No parity gaps in required env keys.
- Staging behaves as production rehearsal.

---

## Suggested 48-Hour Execution Plan

## Day 1

- Complete secret migration and staging validation.
- Set up dashboards and alert routing.
- Trigger test alerts.

## Day 2

- Run backup/restore drill.
- Complete staging parity diff and sign-off.
- Run final production smoke checklist.

---

## Final Go/No-Go Checklist

- [ ] Secrets rotated and stored only in secret manager
- [ ] Alerting verified with test incidents
- [ ] Backup restore drill completed and documented
- [ ] Staging parity checklist signed off
- [ ] `/api/health/live` and `/api/health` green in production
- [ ] Login + forecast + dispatch critical flows smoke-tested

---

## Provider-Specific Execution

Pick the section that matches your deployment platform.

## Railway

### Secrets

1. Open the backend Railway service.
2. Go to Variables and set:
   - `NODE_ENV=production`
   - `JWT_SECRET` (32+ chars)
   - `EDGE_INGEST_SHARED_SECRET` (32+ chars)
   - `DATABASE_URL`, `REDIS_URL`
   - provider API keys
3. Repeat for staging service with staging values.

### Deploy and validate

1. Trigger deploy on staging.
2. Validate:
   - `GET https://<staging-backend>/api/health/live`
   - `GET https://<staging-backend>/api/health`
   - `SMOKE_API_BASE_URL=https://<staging-backend> npm run smoke:api`
3. Promote same key set to production and deploy.
4. Run same checks on production URL.

### Backup/restore drill

1. Use Railway Postgres snapshot/backup tooling.
2. Restore into staging DB service.
3. Point staging backend `DATABASE_URL` to restored instance.
4. Re-run smoke checks and app sanity tests.

### Alerting

1. Use Railway metrics/logs plus external log sink integration.
2. Configure alerts for downtime, 5xx spikes, and provider degradation signals.
3. Send test alert and confirm delivery to Slack/PagerDuty/email.

## Render

### Secrets

1. Open backend Web Service > Environment.
2. Set production keys (`JWT_SECRET`, `EDGE_INGEST_SHARED_SECRET`, DB/Redis URLs, provider keys).
3. Mirror key names in staging service.

### Deploy and validate

1. Deploy staging backend and frontend.
2. Validate:
   - `GET https://<staging-backend>.onrender.com/api/health/live`
   - `GET https://<staging-backend>.onrender.com/api/health`
   - `SMOKE_API_BASE_URL=https://<staging-backend>.onrender.com npm run smoke:api`
3. Promote config and deploy production services.
4. Re-run checks in production.

### Backup/restore drill

1. Create backup from Render Postgres.
2. Restore to staging database.
3. Point staging `DATABASE_URL` to restored DB.
4. Validate with smoke checks and UI flows.

### Alerting

1. Configure Render alerts for service health and deploy failures.
2. Add external log/metrics sink for richer 5xx and provider degradation alerting.
3. Test notification routing.

## Fly.io

### Secrets

1. Set backend secrets:
   - `fly secrets set JWT_SECRET=... EDGE_INGEST_SHARED_SECRET=... DATABASE_URL=... REDIS_URL=...`
   - plus provider keys
2. Repeat for staging Fly app.

### Deploy and validate

1. Deploy staging app (`fly deploy`).
2. Validate:
   - `GET https://<staging-backend>.fly.dev/api/health/live`
   - `GET https://<staging-backend>.fly.dev/api/health`
   - `SMOKE_API_BASE_URL=https://<staging-backend>.fly.dev npm run smoke:api`
3. Deploy production app.
4. Re-run checks in production.

### Backup/restore drill

1. Use attached Postgres provider backup tooling (Fly Postgres or external managed DB).
2. Restore to staging DB target.
3. Update staging `DATABASE_URL` and redeploy.
4. Validate full smoke path.

### Alerting

1. Use Fly logs/metrics plus external monitoring stack.
2. Configure:
   - instance down
   - 5xx threshold
   - health endpoint failure
3. Send synthetic test incident and verify on-call delivery.
