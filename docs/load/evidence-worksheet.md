# Load test evidence worksheet

| Field | Value |
|-------|-------|
| Test date | 2026-07-22 |
| Environment | live Render health; restore Neon backend `127.0.0.1:4010` (memory replay) for signed ingest + sockets |
| Commit SHA | `a1c1608` / prior fan-out on `7fd0ba3` |
| Image digest | `sha256:1a0f0aa1c724c026732951b5868ec9941e3b19638150c01baee6f8a27ed24928` (signed; not staging-promoted) |
| Load model version | k6 `http-health-slo.js` + `sustained-ingest.js`; `socketio-fanout.mjs`; `socketio-reconnect-storm.mjs` |
| Site/device/tenant model | restore admin JWT; device `upington-solar-farm-node` credential v7 (fingerprint-only evidence) |
| Scenario(s) | live health k6; signed ingest 1 VU × 40s @ 2 rps target (5 accepted); `/simulation` fan-out; reconnect storm |
| Peak RPS / VUs / sockets | health ~20 iters/s; signed ingest effective ~0.12 rps (Neon latency); 15 sockets |
| Duration | health 20s; signed ingest 40s; fan-out 12s; reconnect 4 cycles |
| SLO result (pass/fail) | **PASS** live health p95 400 ms; **PASS** signed ingest 5/5 (p95 10.7 s vs 15 s budget); fan-out/reconnect PASS |
| Lost/duplicate check | N/A (short drill) |
| Redis/DB chaos result | **Open** — Docker Desktop engine returned API 500; chaos script added but not executed |
| Recovery notes | Multi-VU signed ingest races sequence watermark; use 1 VU or per-VU credentials. Sequence values must fit INT4. Default edge rate limit 30/min — raise `EDGE_RATE_LIMIT_MAX_PER_MINUTE` for drills. |
| Capacity/cost delta | Open |
| API/ingest p50, p95, p99 | health p95 400 ms; signed ingest p50/p95 7.54 / 10.7 s (restore Neon) |
| WebSocket connect/fan-out p95 and delivery count | fan-out n=15 p95 1 ms; reconnect 60/60 p95 63 ms |
| Database/Redis resource graph URL | Open |
| Alert trigger/ack/clear result | Local dispatcher PASS; Render webhook Open |
| Raw artifact path / SHA-256 | k6 health `5e66d876…c1bd`; signed ingest `374276c3…4405`; cred provision `901fbe03…790f5`; fan-out `9bc570c2…dcfa`; reconnect `045e5d19…a633` |
| Issue / ticket | #50 |
| Approver | _pending_ |

## Remaining before closing #50

- [x] k6 installed + live health SLO
- [x] Signed ingest smoke (restore, 1 VU) — **not** a capacity proof (p95 10.7 s rejected as operational target)
- [x] Socket.IO connect soak / event fan-out / reconnect storm (restore)
- [ ] Multi-device staging sustained + peak/burst with ingest p95 **&lt; 1 s**
- [ ] 100 / 500+ WebSocket clients + real telemetry fan-out + reconnect storms
- [ ] Redis recovery under load (local Docker previously blocked)
- [ ] Resource graphs + written capacity statement + approver

Attach: k6 summary JSON, Socket.IO JSON output, metrics screenshots, database
and Redis graphs, alert evidence, and an explicit accepted-capacity statement.
