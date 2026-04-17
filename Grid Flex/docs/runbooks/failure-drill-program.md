# Failure Drill Program

Use this program to run routine resilience drills for provider, cache, and dependency outages.

## Drill Cadence

- Monthly: provider outage simulation
- Monthly: Redis/cache outage simulation
- Quarterly: database failover/restore simulation

## Drill Objectives

- Validate alerting reaches on-call reliably.
- Verify operator runbooks are actionable.
- Measure detection, mitigation, and recovery times.
- Capture config or tooling gaps and close them.

## Standard Drill Template

1. Preparation
   - identify scenario + scope
   - nominate incident commander and observers
2. Injection
   - apply fault (provider key revoke, Redis disable, DB lock)
3. Detection
   - confirm expected alerts fire
4. Response
   - execute runbook steps and mitigations
5. Recovery
   - restore service and validate health/smoke checks
6. Retrospective
   - record timeline, learnings, and follow-up actions

## Required Metrics

- MTTD (time to detect)
- MTTM (time to mitigate)
- MTTR (time to recover)
- false positive/false negative alert counts

## Evidence

- alert IDs and timestamps
- incident timeline notes
- command/log snippets
- follow-up issue tracker links

## Drill Scenarios

- Forecast provider outage
  - primary provider unavailable, fallback path engaged
- Cache outage
  - Redis unavailable, app falls back to in-memory cache
- Database degradation
  - increased latency or transient query failures

## Success Criteria

- Health endpoints restored within target RTO.
- User-critical flows (login, dashboard, forecast, dispatch) succeed post-recovery.
- Post-drill actions tracked with owners and due dates.
