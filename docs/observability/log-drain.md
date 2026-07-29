# Log drain / webhook delivery

## Structured events (backend)

Key events for drains:

- `edge.ingest.accepted` / `edge.ingest.rejected`
- Replay / signature failures (auth middleware)
- Alert webhook dispatch outcomes

## Alert webhook

| Env | Purpose |
|-----|---------|
| `ALERT_WEBHOOK_ENABLED` | Master switch (Render default `false` until sink ready) |
| `ALERT_WEBHOOK_URL` | HTTPS endpoint (PagerDuty / Slack / Better Stack) |
| `ALERT_WEBHOOK_TOKEN` | Optional bearer shared with sink |
| `ALERT_WEBHOOK_COOLDOWN_MS` | Dedup window |
| `ALERT_WEBHOOK_INCLUDE_INFO` | Usually false in production |

Blueprint: `render.yaml` marks URL/token as `sync: false` (set in dashboard).

## Escalation

1. Channel notification (warning).
2. On-call page for critical (`A-03`, `A-04`, `A-12`).
3. After-hours: same on-call rotation; safety violations also notify Safety lead.

Fire-drill evidence belongs on the evidence completion board before marking observability Done.
