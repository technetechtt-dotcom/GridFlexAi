# Load test evidence worksheet

| Field | Value |
|-------|-------|
| Test date | 2026-07-22 (health + restore Socket.IO connect) |
| Environment | live Render health; Socket.IO against Neon restore backend `127.0.0.1:4010` |
| Commit SHA | `b12b007` (post-RC); health baseline tied to `d1a7363` / `RC-2026-07-22` |
| Image digest | _pending_ |
| Load model version | `scripts/load-baseline.mjs` + `load/socketio-fanout.mjs` |
| Site/device/tenant model | restore-drill admin JWT (Socket.IO); health N/A |
| Scenario(s) | health live baseline (200/20); Socket.IO 25 clients × 8 s connect soak |
| Peak RPS / VUs / sockets | ~40 rps / 20 workers; 25 sockets |
| Duration | ~5 s health; ~8 s socket |
| SLO result (pass/fail) | **PASS** health p95 1250 ms; **PASS** Socket.IO 25/25 connect, p95 130 ms |
| Lost/duplicate check | N/A |
| Redis/DB chaos result | Open |
| Recovery notes | k6 not installed; event fan-out samples=0 (connect-only); live multi-instance soak Open |
| Capacity/cost delta | Open |
| API/ingest p50, p95, p99 | 371 / 1250 / 1507 ms (health) |
| WebSocket connect/fan-out p95 and delivery count | connect p50/p95 107/130 ms; fan-out samples 0 (awaitEvent=false) |
| Database/Redis resource graph URL | Open |
| Alert trigger/ack/clear result | Local dispatcher fire-drill PASS; Render webhook Open |
| Raw artifact path / SHA-256 | health `c03f2c9dfffb39ca38f7327e452f5268ab0d82d72b77c52c312bb1457d326055`; socket `2be3c8a5393003d96c806f32212555bebb84e904caaa990547c1aba5aefd6687` |
| Issue / ticket | #50 |
| Approver | _pending_ |

## Remaining before closing #50

- [ ] k6 sustained ingest + burst + replay (signed device credential)
- [x] Socket.IO connect soak (restore localhost) — event fan-out / reconnect storm still Open
- [ ] Redis recovery under load
- [ ] Resource graphs + approver

Attach: k6 summary JSON, Socket.IO JSON output, metrics screenshots, database
and Redis graphs, alert evidence, and an explicit accepted-capacity statement.
