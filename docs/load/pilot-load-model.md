# Pilot load model

Replace example figures with **expected pilot** values. Always keep at least a **3× safety margin** for soak tests.

## Baseline expectation (example — edit for site)

| Parameter | Expected pilot | 3× test target |
|-----------|----------------|----------------|
| Edge nodes | 100 | 300 |
| Reading interval | 5 s | 5 s (same) |
| Nominal ingest rate | 20 rps | 60 rps |
| Reconnect burst | 5× | 15× short burst |
| Dashboard users | 100 | 300 |
| Readings per chart query | 10,000 | 30,000 (or max API page) |
| Simultaneous Socket.IO connections | 500 | 1,500 |

**Site-specific overrides:** record below after plant onboarding.

| Parameter | Agreed value | Source | Date |
|-----------|--------------|--------|------|
| Edge nodes | | | |
| Interval | | | |
| Peak ingest rps | | | |
| Dashboard concurrency | | | |
| Socket connections | | | |

## Derived rates

- Nominal ingest ≈ `nodes / interval_seconds`
- Burst reconnect ≈ all nodes reconnect within 60–120 s → short spike on auth + queue drain
- Fan-out ≈ ingest × subscribed dashboard connections (cap with rooms)

## Scenarios mapped

| Scenario | Script | Model driver |
|----------|--------|--------------|
| Sustained edge ingestion | `load/k6/sustained-ingest.js` | 3× rps |
| Device reconnect burst | `load/k6/reconnect-burst.js` | 3× burst VUs |
| Duplicate/replay traffic | `load/k6/replay-duplicate.js` | Same nonce / seq |
| Authenticated dashboard reads | `load/k6/dashboard-reads.js` | 3× users |
| Historical chart queries | `load/k6/chart-queries.js` | Large window |
| Concurrent WebSocket | `load/socketio-fanout.mjs` | 3× connections |
| One-to-many fan-out | `load/socketio-fanout.mjs` | Publishers + subscribers |
| Redis restart | Manual chaos + observe | Ops |
| Database slowdown | Staging throttle / notes | Ops |
| Forecast provider timeout | `load/k6/forecast-timeout.js` | Circuit behaviour |
