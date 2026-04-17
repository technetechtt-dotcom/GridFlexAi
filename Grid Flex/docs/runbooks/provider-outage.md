# Runbook: Forecast Provider Outage

## Trigger

- `/api/forecast/providers/status` reports degraded provider states.
- Forecast latency/error alerts fire.

## Immediate Actions

1. Confirm outage scope from provider status/history endpoints.
2. Verify circuit-breaker behavior and fallback messages are present in API responses.
3. Notify operations channel with impact summary (affected providers, fallback mode).

## Operator Checks

- `GET /api/forecast/providers/status`
- `GET /api/forecast/providers/history`
- `GET /api/forecast?lat=<lat>&lon=<lon>&capacity=<kw>`

## Mitigation

- Keep serving hybrid responses with available providers.
- Temporarily reduce cron frequency if upstream limits are the root cause.
- Ensure Redis cache is healthy to reduce external pressure.

## Recovery Criteria

- Primary provider outcome returns to `ok` consistently for 30+ minutes.
- Forecast endpoint latency and error rates return to baseline.

## Post-Incident

- Record outage window and impact in incident log.
- Tune rate-limit/circuit-breaker settings if needed.
