# Capacity Forecasting and Cost Guardrails

## Load-test linkage

Formal soak tests: [`docs/LOAD_TESTING.md`](../LOAD_TESTING.md) and [`docs/load/capacity-cost-estimates.md`](../load/capacity-cost-estimates.md). Update this runbook after each quarterly load run.

## Goal

Prevent performance regressions and cloud cost surprises as traffic and telemetry volume grow.

## Capacity Planning Inputs

- daily and peak request volume
- telemetry ingestion rate (events/minute)
- p95 and p99 latency trends
- database CPU/memory/IO trends
- Redis memory and eviction rates

## Guardrail Thresholds

- API p95 latency:
  - warning: > 500ms
  - critical: > 900ms
- HTTP 5xx:
  - warning: > 1%
  - critical: > 2%
- DB CPU:
  - warning: > 70% sustained
  - critical: > 85% sustained
- Redis memory:
  - warning: > 75%
  - critical: > 90%
- Monthly spend:
  - warning: 80% of budget
  - critical: 95% of budget

## Monthly Planning Loop

1. Export 30-day usage and performance metrics.
2. Estimate next 30/60/90-day demand.
3. Compare projected headroom against thresholds.
4. Pre-plan scaling changes (DB class, cache size, app replicas).
5. Review and approve budget impact.

## Cost Controls

- enforce environment-specific budgets and alerts
- cap log retention where feasible
- right-size non-production resources
- schedule off-hours downscaling for staging
- audit unused resources monthly

## Evidence

- monthly capacity forecast artifact
- budget alert history
- scaling decisions and implementation notes
- sign-off from engineering + operations owners
