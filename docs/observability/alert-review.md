# Weekly alert review

Remove noise; tune thresholds; confirm owners and runbooks remain valid.  
Catalog: [`ALERT_CATALOG.md`](./ALERT_CATALOG.md) · Ops sprint Day 3: [`../runbooks/ops-execution-sprint.md`](../runbooks/ops-execution-sprint.md)

| Week | Reviewer | Alerts fired | False positives | Threshold changes | Notes |
|------|----------|--------------|-----------------|-------------------|-------|
| _TBD_ | | | | | |

## Fire-drill procedure (critical path)

1. Confirm log drain receives JSON (`event`, `traceId`, `requestId`).
2. Confirm metrics scrape works:
   ```bash
   curl -sH "Authorization: Bearer $METRICS_SCRAPE_TOKEN" https://<env>/api/metrics | findstr /i gridflex
   ```
3. Trigger controlled failures covering every release-critical route:
   - Send one invalid edge signature → expect `edge.auth.signature_failed` + `gridflex_signature_failures_total`
   - Generate an API error-rate/latency breach
   - Create ingest backlog/rejections and a device-offline condition
   - Exercise WebSocket connection/fan-out threshold
   - Exercise isolated database, Redis and KMS dependency failures
4. Confirm alert fires on the configured channel within the catalog SLA.
5. On-call acknowledges; capture screenshot or ticket link.
6. Restore normal config; verify alert clears.
7. Log the row below.

## Fire-drill log

| Date / env | Commit / digest | Alert ID | Trigger UTC | Delivered UTC | Ack UTC | Clear UTC | Recipient / escalation | Evidence URL / SHA-256 |
|------------|-----------------|----------|-------------|---------------|---------|-----------|------------------------|-----------------------|
| 2026-07-22 / live Render (probe only) | `d268871` | edge auth reject path | 2026-07-22T12:16:48Z | n/a (no webhook configured in probe) | n/a | n/a | unauth metrics→503; bad edge sig→401 | probe only — full webhook fire-drill still Open |
| 2026-07-22 / local loopback | `b12b007` | `fire_drill.critical.edge_auth` | 2026-07-22T13:43:41Z | 2026-07-22T13:43:41Z | n/a (local receiver) | n/a | dispatcher → local `/hook` | `go-live-reports/alert-webhook-fire-drill.json` SHA-256 `c50405a5897c98fb564fabf43511d2a2cc598b2d72376d76eed449030dceb4b5` — **does not** prove Render `ALERT_WEBHOOK_*` |
| _TBD_ | | | | | | | | |
