# Load test SLOs / thresholds

Pilot software gate targets (contract may tighten further):

| Metric | Threshold |
|--------|-----------|
| Accepted ingest p95 | **&lt; 1 s** (internal stretch: &lt; 300 ms) |
| Dashboard / Socket event p95 | **&lt; 2 s** |
| Ingest error rate | **&lt; 0.5%** |
| WebSocket delivery | **≥ 99.5%** |
| Recovery after Redis restart | **&lt; 60 s** |
| Cross-tenant leakage | **Zero** |
| Duplicate stored readings | **Zero** (idempotent ACK OK) |
| Authenticated API p95 | &lt; 500 ms |
| Lost accepted messages | **0** |

**Non-goal:** The restore-branch smoke ingest p95 of **~10.7 s** (1 VU, cold Neon) is **not** an accepted operational standard. Close #50 only with multi-device staging evidence meeting the table above.

k6 thresholds are encoded in each script's `options.thresholds`. Failing thresholds → non-zero exit.

## Required scenarios before closing #50

- Multiple independent virtual devices (separate credentials)
- Sustained normal ingest + peak/burst
- 100 / 500 / projected-peak WebSocket clients with real telemetry fan-out
- Reconnect storms; Redis disruption under traffic
- Duplicate, delayed, replayed, out-of-order telemetry
- DB/Redis resource observation + explicit pass/fail capacity statement

## Failure modes that must remain safe

| Condition | Expected |
|-----------|----------|
| Redis restart | Ingest fails closed in production; no silent accept without replay protection |
| DB slowdown | Latency rises; no corruption; device queue retains data |
| Forecast timeout | Circuit breaker; API remains up |
