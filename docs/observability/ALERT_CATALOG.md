# Alert catalog

| ID | Alert | Severity | Owner | Escalation | Threshold (starting) | Runbook | Route |
|----|-------|----------|-------|------------|----------------------|---------|-------|
| A-01 | API error rate high | warning→critical | Platform eng | Channel → on-call at critical | 5xx > 2% / 5m; critical > 5% | `docs/runbooks/release-rollback.md` | channel → on-call |
| A-02 | p95 latency breach | warning | Platform eng | Channel | p95 > 1500ms / 5m | `docs/runbooks/capacity-cost-guardrails.md` | channel |
| A-03 | Database unavailable | critical | Platform eng | On-call + SMS immediately | health DB check fail | `docs/runbooks/db-outage.md` | on-call + SMS |
| A-04 | Redis unavailable | critical | Platform eng | On-call (ingest fail-closed) | `gridflex_redis_up == 0` | `docs/runbooks/provider-outage.md` | on-call |
| A-05 | Elevated device-auth failures | warning | Edge ops | Channel; security if sustained | signature failures spike / 5m | `docs/DEVICE_PROVISIONING.md` | channel |
| A-06 | Device offline/stale | warning | Edge ops | Channel + email | last-seen > staleAfterSec | `docs/runbooks/operator-command-sheet.md` | dashboard + email |
| A-07 | Ingest rate zero | warning | Edge ops | Channel | accepted=0 while devices expected | `docs/EDGE_RELIABILITY.md` | channel |
| A-08 | Replay attempts | warning | Security | Channel | replay counter rising | `docs/runbooks/secret-rotation.md` | channel |
| A-09 | Edge queue near capacity | warning | Edge ops | Channel | `gridflex_edge_queue_depth_max` / device capacity > 80% | `docs/INGEST_PROCESSING.md` | channel |
| A-10 | Forecast providers degraded | warning | Platform eng | Channel | provider errors / 15m | `docs/runbooks/provider-outage.md` | channel |
| A-11 | Disk/DB growth | warning | Platform eng | Email | storage > 80% plan | `docs/runbooks/database-backup-restore.md` | email |
| A-12 | Physical-execution safety violation | critical | Safety lead | On-call + SMS + Safety lead | any increment of safety counter | `docs/COMMAND_SAFETY.md` | on-call + SMS |

### After-hours

Same primary on-call rotation. Critical alerts (A-03, A-04, A-12) page regardless of business hours. Warning alerts stay in-channel unless sustained > 30m.

Configure these rules in Grafana / Datadog / Better Stack / hosting alerts against `/api/metrics` and structured logs. See also `docs/observability/dashboards.md` and `docs/observability/log-drain.md`.
