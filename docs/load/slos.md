# Load test SLOs / thresholds

Starting targets for pilot (adjust with contract):

| Metric | Threshold |
|--------|-----------|
| API availability | ≥ 99.5% |
| Authenticated API p95 | < 500 ms |
| Ingest p95 | < 300 ms |
| Socket fan-out p95 | < 2 s |
| Unexpected error rate | < 1% |
| Lost accepted messages | **0** |
| Duplicate readings (same device+seq) | **0** new rows (idempotent ACK OK) |

k6 thresholds are encoded in each script's `options.thresholds`. Failing thresholds → non-zero exit.

## Failure modes that must remain safe

| Condition | Expected |
|-----------|----------|
| Redis restart | Ingest fails closed or memory fallback per env; no silent accept without replay protection in prod |
| DB slowdown | Latency rises; no corruption; queue on device retains data |
| Forecast timeout | Circuit breaker; API remains up |
