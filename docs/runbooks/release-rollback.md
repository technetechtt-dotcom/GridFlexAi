# Runbook: Release Rollback

## Trigger

- New deployment causes elevated 5xx, failed smoke checks, or severe functional regression.

## Immediate Actions

1. Halt rollout.
2. Roll back backend to previous known-good image/revision.
3. If frontend is impacted, roll back static bundle/deployment alias.
4. Announce rollback and current status in ops channel.

## Verification

- `GET /api/health/live` returns 200.
- `GET /api/health` returns 200.
- Critical user flows succeed (login, dashboard load, forecast, dispatch page).

## Data Safety

- If migrations were part of release, confirm compatibility before rollback.
- For destructive migrations, use forward-fix strategy unless restore is approved.

## Post-Rollback

- Capture timeline and triggering signal.
- Open follow-up issue with root cause and prevention action items.
