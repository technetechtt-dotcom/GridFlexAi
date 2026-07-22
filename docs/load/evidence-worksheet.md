# Load test evidence worksheet

| Field | Value |
|-------|-------|
| Test date | 2026-07-22 (health baseline only) |
| Environment | live Render `gridflex-backend.onrender.com` (read-only health) |
| Commit SHA | `d1a7363` / `RC-2026-07-22` |
| Image digest | _pending_ |
| Load model version | `scripts/load-baseline.mjs` |
| Site/device/tenant model | N/A (health only) |
| Scenario(s) | health live baseline (200 requests, concurrency 20) |
| Peak RPS / VUs / sockets | ~40 rps / 20 workers |
| Duration | ~5 s wall |
| SLO result (pass/fail) | **PASS** vs p95 budget 2000 ms (observed p95 1250 ms); 0 failures |
| Lost/duplicate check | N/A |
| Redis/DB chaos result | Open |
| Recovery notes | k6 not installed on runner workstation; full ingest/socket soak still Open |
| Capacity/cost delta | Open |
| API/ingest p50, p95, p99 | 371 / 1250 / 1507 ms (health) |
| WebSocket connect/fan-out p95 and delivery count | Open |
| Database/Redis resource graph URL | Open |
| Alert trigger/ack/clear result | Open |
| Raw artifact path / SHA-256 | `go-live-reports/live-health-load-baseline.txt` · `c03f2c9dfffb39ca38f7327e452f5268ab0d82d72b77c52c312bb1457d326055` |
| Issue / ticket | #50 |
| Approver | _pending_ |

## Remaining before closing #50

- [ ] k6 sustained ingest + burst + replay (signed device credential)
- [ ] Socket.IO fan-out / reconnect storm
- [ ] Redis recovery under load
- [ ] Resource graphs + approver

Attach: k6 summary JSON, Socket.IO JSON output, metrics screenshots, database
and Redis graphs, alert evidence, and an explicit accepted-capacity statement.
