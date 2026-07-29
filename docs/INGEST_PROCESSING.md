# Edge ingest processing (idempotency, quarantine, DLQ)

## Contract

| Concern | Mechanism |
|---------|-----------|
| Idempotency | `deviceId` + `sequenceNumber` via `EdgeIngestReceipt`; duplicate ACK → HTTP 200 |
| Replay | Redis `SET NX` nonce (`EDGE_REPLAY_REQUIRE_REDIS=true` in production) |
| Quarantine | Out-of-range samples stored with `quality=invalid`; live KPI queries exclude them |
| Device buffer | ESP32 LittleFS journal (`queueDepth` reported on ingest) — primary retry store |
| Server DLQ | **Not implemented as a separate queue**; rejected auth/replay never persist samples |

## Metrics (`/api/metrics`)

| Metric | Meaning |
|--------|---------|
| `gridflex_ingest_accepted_total` | Auth + business accept (includes idempotent ACK) |
| `gridflex_ingest_duplicate_ack_total` | Idempotent duplicate sequence ACKs |
| `gridflex_ingest_quarantined_total` | Accepted rows with `quality=invalid` |
| `gridflex_ingest_rejected_total` | Auth/validation/replay failures |
| `gridflex_edge_queue_depth_max` | Max device-reported `queueDepth` this process |
| `gridflex_redis_up` | Replay store availability |

## Retention / reprocessing

- Telemetry retention: `TELEMETRY_RETENTION_*` (cron off by default; purge gated).
- Invalid-quality rows are retained with readings until retention policy applies; they are not auto-promoted to `valid`.
- Reprocessing path: operator corrects device/firmware, then new sequences ingest cleanly. Do not rewrite historical `quality` without an audited script.
- Server-side DLQ (persist rejected payloads for later replay) remains a future option; until then, devices must retain unacked journal entries.

## Operator alerts

- A-07 ingest rate zero, A-08 replay attempts, A-09 edge queue near capacity — see `docs/observability/ALERT_CATALOG.md`.
