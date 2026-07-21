# Hardware-in-the-loop (HIL) — Phase 6

HIL validation is required before any physical plant command path.

GridFlex remains advisory and does **not** replace protection relays, PPC safety interlocks, or BMS protection. `PHYSICAL_COMMAND_EXECUTION_ENABLED` and `HIL_PLANT_APPROVAL_CONFIRMED` must both stay `false` until plant sign-off.

Alarm acknowledgement never equates to control authority.

## Safe test bench (no live control outputs)

| Component | Role |
|-----------|------|
| Real ESP32 edge node | `firmware/GridFlexEdge` |
| Modbus inverter simulator or isolated test inverter | Read-only FC03 only |
| Controllable network interruption | Airplane mode / firewall / LTE detach |
| Staging API + database | Separate from production |
| Redis | Replay / nonce protection |
| Monitoring + dashboards | Staging Ops Center |

**Do not connect control outputs to a live plant.**

## Required test matrix

| Test | Input | Expected result | CI / worksheet |
|------|-------|-----------------|----------------|
| Malformed JSON | Invalid body | HTTP 400; no record | App error handler + HIL-01 |
| Missing field | No frequency/timestamp as required | Validation response | HIL-02 |
| Invalid signature | Modified payload | HTTP 401 | `edge-data` / V1 tests |
| Old timestamp (header) | Outside skew | HTTP 401 | Edge auth skew |
| Duplicate nonce | Reused nonce | Rejected 409 | Replay tests |
| Duplicate sequence | Same device sequence | Idempotent acknowledgement | V1 idempotent + receipt |
| Delayed data | Old measurement, valid upload | Stored as delayed/stale | HIL-08 |
| Future timestamp | Beyond tolerance | Rejected | HIL-07 |
| Excess voltage / range | Outside engineering range | Bad quality / alarm | HIL-05 |
| Negative PV output | Unexpected negative | Flagged, not normalized | HIL-06 |
| NaN/infinity | Invalid numeric | Rejected | HIL-03 / HIL-13 |
| Oversized payload | Above body / batch limit | HTTP 413 | HIL-04 + 1mb JSON limit |
| Rapid traffic | Over rate limit | HTTP 429 | `edgeIngestLimiter` |
| Lost LTE | Offline period | Persistent queue grows | HIL-10 |
| Reconnect | LTE restored | Ordered replay | HIL-10 |
| Power loss | Queue contains records | Queue survives reboot | HIL-11 |
| Redis outage | Replay degraded | Safe configured behaviour (`EDGE_ALLOW_MEMORY_REPLAY` / fail-closed) | env safety |
| Database outage | Ingest unavailable | Device retains queue | firmware behaviour |
| Clock drift | Incorrect ESP32 clock | Alert + NTP correction | firmware `syncTime` |
| Wrong register scale | Extreme decoded value | Validation catches | HIL-05 + inverter worksheet |
| Remote config physical enable | Control fields in bundle | Rejected server + device | HIL-14 |
| Queue full | Overflow enqueue | Refuse overwrite | HIL-15 + firmware |
| SunSpec sentinel / SF | −32768 / missing SF | unavailable / uncertain | `sunspec-register-plan.test.ts` |
| Malformed Modbus / CRC / FC | Wire faults | Bench worksheet | Open — physical HIL |
| Watchdog reset recovery | TWDT trip | NVS counters + telemetry | Firmware + bench Open |

Automated packet cases: `backend/tests/hil-packet-matrix.test.ts`, `backend/tests/sunspec-register-plan.test.ts`.

CI compiles `firmware/GridFlexEdge` twice for ESP32-S3 with PlatformIO:
`esp32s3-wifi-ci` (Wi-Fi + Modbus) and `esp32s3-lte-ci` (SIM7670X/TinyGSM TLS +
Modbus). This catches ESP32, queue, SunSpec/Modbus, crypto, storage, and LTE
transport build regressions. Compilation is **not** modem or physical bus
evidence; those rows remain open until run on the isolated bench.
The LTE compile profile assigns RS485 DE/RE to GPIO 25; confirm that pin against
the approved board/BOM before wiring. Firmware now rejects builds where RS485
DE/RE conflicts with the modem power pin.

## Evidence (every test)

Record in `docs/equipment/hil-evidence-worksheet.md`:

- test identifier; firmware version; backend commit; hardware serial number
- setup; expected result; actual result; log extract; screenshot or output
- pass/fail; reviewer; date

## Acceptance

- All security and data-integrity cases pass.
- No malformed value reaches operator KPIs as **good-quality** data.
- Outage recovery preserves ordering and original `measuredAt` / `deviceTimestamp`.
- Results signed off by engineering **and** the plant representative.
