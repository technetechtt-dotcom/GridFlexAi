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
| Malformed JSON | Invalid body | HTTP 400; no record | HIL-01 |
| Missing field | Required measurement omitted | Validation response | HIL-02 |
| NaN/infinity | Invalid numeric | Rejected | HIL-03 |
| Oversized payload | Above body / batch limit | HTTP 413 | HIL-04 |
| Excess voltage / range | Outside engineering range | Bad quality / alarm | HIL-05 |
| Negative PV output | Unexpected negative | Flagged, not normalized | HIL-06 |
| Delayed data | Old measurement, valid upload | Stored as delayed/stale | HIL-07 |
| Future timestamp | Beyond tolerance | Rejected | HIL-08 |
| Unsigned/bad remote config | Invalid bundle/signature | Device rejects bundle | HIL-09 |
| Expired remote config | Expired bundle | Device rejects bundle | HIL-10 |
| Disconnect queue growth | Network unavailable | Persistent queue grows | HIL-11 |
| Reconnect replay | Network restored | Ordered replay | HIL-12 |
| Reboot recovery | Queue contains records | Queue snapshot survives reboot | HIL-13 |
| Invalid ingest signature | Modified payload | HTTP 401 + alert | HIL-14 |
| Duplicate nonce | Reused nonce | Rejected 409 | HIL-15 |
| Duplicate sequence | Same sequence and body | Idempotent acknowledgement | HIL-16 |
| LTE interruption | Modem detached | Queue grows; reconnects safely | HIL-17 |
| Power loss during write | Remove power at each queue stage | Journal recovers without corrupt record | HIL-18 |
| Redis/database outage | Dependency unavailable | Fail-safe ingest; device retains queue | HIL-19 |
| Wrong register scale | Extreme decoded value | Validation catches | HIL-20 |
| Malformed Modbus / CRC / FC | Wire faults | Frame rejected; no good-quality reading | HIL-21 |
| Watchdog reset recovery | TWDT trip | NVS counters + telemetry; queue recovers | HIL-22 |
| Queue full | Overflow enqueue | Refuse overwrite and expose alarm/metric | HIL-23 |
| Remote config physical enable | Control fields in bundle | Rejected server + device | HIL-24 |
| Clock drift | Incorrect ESP32 clock | Alert + NTP correction | HIL-25 |

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
