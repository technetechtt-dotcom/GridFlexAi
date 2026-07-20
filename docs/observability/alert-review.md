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
3. Trigger a **controlled** failure (pick one):
   - Send one invalid edge signature → expect `edge.auth.signature_failed` + `gridflex_signature_failures_total`
   - Temporarily break health probe / dependency → expect health alert
4. Confirm alert fires on the configured channel within the catalog SLA.
5. On-call acknowledges; capture screenshot or ticket link.
6. Restore normal config; verify alert clears.
7. Log the row below.

## Fire-drill log

| Date | Alert ID | Recipient reached? | Channel | Ack time | Evidence link |
|------|----------|--------------------|---------|----------|---------------|
| _TBD_ | | | | | |
