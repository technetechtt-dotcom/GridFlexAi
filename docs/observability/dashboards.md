# Dashboard stubs (staging / production)

Scrape `/api/metrics` with `Authorization: Bearer $METRICS_SCRAPE_TOKEN` (production).

## Panel set (minimum)

| Panel | Query / signal | Alert link |
|-------|----------------|------------|
| Request rate | `gridflex_http_requests_total` rate | A-01 |
| 5xx rate | `gridflex_http_errors_5xx_total` / requests | A-01 |
| p95 latency | `gridflex_http_latency_ms_p95` | A-02 |
| Redis up | `gridflex_redis_up` | A-04 |
| Ingest accepted | `gridflex_ingest_accepted_total` rate | A-07 |
| Quarantine rate | `gridflex_ingest_quarantined_total` rate | Edge ops |
| Edge queue depth | `gridflex_edge_queue_depth_max` | A-09 |
| Signature failures | `gridflex_signature_failures_total` rate | A-05 |
| Physical safety | `gridflex_physical_safety_violations_total` | A-12 |

## Ownership

- **Platform eng**: HTTP, DB, Redis, forecast panels.
- **Edge ops**: ingest, signature, queue depth, device offline.
- **Safety lead**: physical-execution counter (must stay 0 while pilot lock is on).

Import JSON for Grafana/Datadog is environment-specific; keep panel IDs aligned with alert catalog IDs (A-01…).
