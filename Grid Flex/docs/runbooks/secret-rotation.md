# Runbook: Secret Rotation

## Scope

- `JWT_SECRET`
- `EDGE_INGEST_SHARED_SECRET`
- Provider API keys (`OPENWEATHER_API_KEY`, `ACCUWEATHER_API_KEY`, `OPENAI_API_KEY`)

## Preconditions

- New secrets generated using high-entropy values.
- Staging validation plan ready.

## Steps

1. Update secrets in staging and deploy.
2. Run smoke checks:
   - Auth login/refresh/logout
   - Edge ingestion signature validation
   - Forecast/provider endpoints
3. Promote secrets to production secret manager.
4. Redeploy backend.
5. Run production smoke checks:
   - `npm run smoke:api` (with target base URL)
   - Auth + forecast + edge ingest sanity checks

## Validation

- No auth token issuance failures.
- No `401` spikes on edge ingest from valid devices.
- No provider auth errors from rotated API keys.

## Rollback

- Revert to previous secret version in secret manager.
- Redeploy backend and confirm recovery.

## Audit Trail

- Record timestamp, operator, rotated keys, and validation results.
