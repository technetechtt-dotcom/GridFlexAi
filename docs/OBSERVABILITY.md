# Centralized observability (Phase 9)

## Structured logs

Stdout JSON lines (Render / Docker collect them into the managed log service, Loki, Datadog, Elastic, or Better Stack):

```json
{
  "timestamp": "2026-07-20T08:30:00.000Z",
  "level": "info",
  "service": "gridflex-api",
  "environment": "staging",
  "requestId": "…",
  "traceId": "…",
  "spanId": "…",
  "organisationId": "…",
  "deviceId": "…",
  "event": "edge.ingest.accepted",
  "durationMs": 24,
  "message": "edge.ingest.accepted"
}
```

- Context via `AsyncLocalStorage` (`backend/src/observability/log-context.ts`)
- Redaction of tokens, secrets, signatures (`backend/src/observability/redact.ts`)
- Never log complete signatures, vault material, or unnecessary raw telemetry payloads

## Metrics

Protected Prometheus text at `GET /api/metrics`:

- Production requires `METRICS_SCRAPE_TOKEN` (Bearer or `x-metrics-token`)
- Low-cardinality labels only (no device/org IDs on metric labels)

Counters/gauges include HTTP traffic & latency p95, ingest accept/reject, signature failures, replay attempts, Socket.IO connections, forecast errors, alarms, optimisation duration, physical-safety violations, process memory, Redis up, DB query avg.

Admin JSON snapshot remains at `/api/admin/metrics`.

## Tracing

- W3C `traceparent` accepted/generated on every request
- `traceId` / `spanId` appear in logs and response headers (`traceparent`, `x-trace-id`)
- Ingest path: ESP32 → auth middleware → validation → DB → event emission shares the same `requestId`/`traceId`

Full OTel exporter (OTLP) can be added later; field layout is OTel-compatible.

## Alerts & routing

Catalog: [`docs/observability/ALERT_CATALOG.md`](./observability/ALERT_CATALOG.md)  
Every alert has severity, owner, threshold guidance, and a linked runbook.

| Severity | Route |
|----------|-------|
| Informational | Ops dashboard |
| Warning | Email / team channel |
| Critical | On-call + SMS/phone |

Weekly review: [`docs/observability/alert-review.md`](./observability/alert-review.md)

## Fire-drill acceptance

1. Force a controlled failure (e.g. invalid signature ingest).
2. Confirm centralized log line with `event=edge.auth.signature_failed` and `traceId`.
3. Confirm `gridflex_signature_failures_total` increments on `/api/metrics`.
4. Page a real on-call recipient for a critical test alert; record in alert-review log.
