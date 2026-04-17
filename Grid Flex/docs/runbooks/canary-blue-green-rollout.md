# Canary / Blue-Green Rollout Runbook

Use this runbook for low-risk production releases with automatic rollback guardrails.

## Scope

- Backend API (`backend/`)
- Frontend static app (`/`)
- Shared dependencies: Postgres, Redis, forecast providers

## Strategy Options

- Canary (preferred):
  - Shift 5% -> 25% -> 50% -> 100% traffic in staged intervals.
- Blue/Green:
  - Deploy full `green` stack, run smoke checks, then switch traffic from `blue`.

## Pre-Deployment Checks

- CI green (`lint`, `typecheck`, `build`, `test`, `e2e`).
- `npm run smoke:api` passes against staging.
- Health endpoints green:
  - `/api/health/live`
  - `/api/health`
- Migration review completed (`prisma migrate deploy`).

## Canary Rollout Procedure

1. Deploy candidate version to production with traffic at 5%.
2. Observe for 10 minutes:
   - p95 latency
   - 5xx error rate
   - auth failures
   - provider degradation states
3. If healthy, move to 25% and observe 10 minutes.
4. If healthy, move to 50% and observe 10 minutes.
5. If healthy, move to 100%.

## Automatic Rollback Triggers

Rollback if any trigger stays breached for 5 continuous minutes:

- API liveness failure rate > 2%.
- HTTP 5xx > 1.5% of requests.
- p95 latency > 2x baseline SLO.
- login or refresh failure spike (>3x normal).
- forecast provider failures cause fallback-only mode for all requests.

## Rollback Procedure

1. Shift traffic to last known healthy release.
2. Verify `/api/health/live` and `/api/health`.
3. Run smoke:
   - login/refresh/logout
   - `/api/readings`
   - `/api/forecast`
4. Open incident timeline and capture:
   - trigger metric
   - rollback timestamp
   - user impact duration

## Evidence to Capture

- rollout timeline screenshot/log
- traffic shift checkpoints and timestamps
- trigger values (if rollback occurred)
- final sign-off by on-call + release owner
