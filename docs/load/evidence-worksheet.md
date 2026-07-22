# Load test evidence worksheet

| Field | Value |
|-------|-------|
| Test date | |
| Environment | staging / HIL |
| Commit SHA | |
| Image digest | |
| Load model version | |
| Site/device/tenant model | |
| Scenario(s) | sustained ingest / burst / growth-retention / replay storm / WebSocket fan-out / reconnect storm / rate limit / Redis recovery |
| Peak RPS / VUs / sockets | |
| Duration | |
| SLO result (pass/fail) | |
| Lost/duplicate check | |
| Redis/DB chaos result | |
| Recovery notes | |
| Capacity/cost delta | |
| API/ingest p50, p95, p99 | |
| WebSocket connect/fan-out p95 and delivery count | |
| Database/Redis resource graph URL | |
| Alert trigger/ack/clear result | |
| Raw artifact path / SHA-256 | |
| Issue / ticket | #50 |
| Approver | |

Attach: k6 summary JSON, Socket.IO JSON output, metrics screenshots, database
and Redis graphs, alert evidence, and an explicit accepted-capacity statement.
