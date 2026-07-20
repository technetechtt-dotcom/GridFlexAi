# Alert catalog

| ID | Alert | Severity | Owner | Threshold (starting) | Runbook | Route |
|----|-------|----------|-------|----------------------|---------|-------|
| A-01 | API error rate high | warning→critical | Platform eng | 5xx > 2% / 5m; critical > 5% | `docs/runbooks/release-rollback.md` | channel → on-call |
| A-02 | p95 latency breach | warning | Platform eng | p95 > 1500ms / 5m | `docs/runbooks/capacity-cost-guardrails.md` | channel |
| A-03 | Database unavailable | critical | Platform eng | health DB check fail | `docs/runbooks/db-outage.md` | on-call + SMS |
| A-04 | Redis unavailable | critical | Platform eng | `gridflex_redis_up == 0` | `docs/runbooks/provider-outage.md` | on-call |
| A-05 | Elevated device-auth failures | warning | Edge ops | signature failures spike / 5m | `docs/DEVICE_PROVISIONING.md` | channel |
| A-06 | Device offline/stale | warning | Edge ops | last-seen > staleAfterSec | `docs/runbooks/operator-command-sheet.md` | dashboard + email |
| A-07 | Ingest rate zero | warning | Edge ops | accepted=0 while devices expected | `docs/EDGE_RELIABILITY.md` | channel |
| A-08 | Replay attempts | warning | Security | replay counter rising | `docs/runbooks/secret-rotation.md` | channel |
| A-09 | Edge queue near capacity | warning | Edge ops | utilisation > 80% | `docs/EDGE_RELIABILITY.md` | channel |
| A-10 | Forecast providers degraded | warning | Platform eng | provider errors / 15m | `docs/runbooks/provider-outage.md` | channel |
| A-11 | Disk/DB growth | warning | Platform eng | storage > 80% plan | `docs/runbooks/database-backup-restore.md` | email |
| A-12 | Physical-execution safety violation | critical | Safety lead | any increment of safety counter | `docs/COMMAND_SAFETY.md` | on-call + SMS |

Configure these rules in Grafana / Datadog / Better Stack / hosting alerts against `/api/metrics` and structured logs.
