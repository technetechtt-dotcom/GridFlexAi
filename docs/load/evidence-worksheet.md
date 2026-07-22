# Load test evidence worksheet

| Field | Value |
|-------|-------|
| Test date | 2026-07-22 (health + Socket.IO fan-out + reconnect) |
| Environment | live Render health; Socket.IO against Neon restore backend `127.0.0.1:4010` |
| Commit SHA | `7fd0ba3` (post-RC); health baseline tied to `d1a7363` / `RC-2026-07-22` |
| Image digest | `sha256:1a0f0aa1c724c026732951b5868ec9941e3b19638150c01baee6f8a27ed24928` (GHCR signed; not yet staging/prod promoted) |
| Load model version | `scripts/load-baseline.mjs` + `load/socketio-fanout.mjs` + `load/socketio-reconnect-storm.mjs` |
| Site/device/tenant model | restore-drill admin JWT; `/simulation` publisher |
| Scenario(s) | health live baseline (200/20); simulation event fan-out 15×12s; reconnect storm 15 clients × 4 cycles |
| Peak RPS / VUs / sockets | ~40 rps / 20 workers; 15 sockets |
| Duration | ~5 s health; ~12 s fan-out; ~4 reconnect cycles |
| SLO result (pass/fail) | **PASS** health p95 1250 ms; **PASS** fan-out p95 1 ms; **PASS** reconnect 100% / p95 63 ms |
| Lost/duplicate check | N/A |
| Redis/DB chaos result | Open |
| Recovery notes | k6 not installed; live multi-instance Redis chaos Open |
| Capacity/cost delta | Open |
| API/ingest p50, p95, p99 | 371 / 1250 / 1507 ms (health) |
| WebSocket connect/fan-out p95 and delivery count | fan-out n=15 p95 1 ms; reconnect attempts 60, success 60, p95 63 ms |
| Database/Redis resource graph URL | Open |
| Alert trigger/ack/clear result | Local dispatcher fire-drill PASS; Render webhook Open |
| Raw artifact path / SHA-256 | health `c03f2c9d…6055`; fan-out `9bc570c2e71bfc3a19acc3991bbffa79ab9bd1e10bb47d612eb5d8bddc75dcfa`; reconnect `045e5d19b22d7516b459ebea0b81fff0d46ca3fea99b12c575f4d46db073a633` |
| Issue / ticket | #50 |
| Approver | _pending_ |

## Remaining before closing #50

- [ ] k6 sustained ingest + burst + replay (signed device credential)
- [x] Socket.IO connect soak (restore localhost)
- [x] Socket.IO `/simulation` event fan-out (restore localhost)
- [x] Socket.IO reconnect storm (restore localhost)
- [ ] Redis recovery under load
- [ ] Resource graphs + approver

Attach: k6 summary JSON, Socket.IO JSON output, metrics screenshots, database
and Redis graphs, alert evidence, and an explicit accepted-capacity statement.
