# HIL evidence worksheet

Complete one row per matrix case. Sign-off requires engineering + plant representative.  
**CI packet suite** (`backend/tests/hil-packet-matrix.test.ts`) covers schema/queue cases on host — mark “CI” in Notes when that is the evidence source. Hardware rows still require bench.

| Field | Value |
|-------|-------|
| Test identifier | |
| Firmware version | 5.1.0-edge-4g-sequenced (or later) |
| Backend commit | |
| Environment / bench identifier | |
| Board manufacturer / model / revision | |
| Hardware serial number | |
| Start / end timestamps (UTC) | |
| Setup | |
| Expected result | |
| Actual result | |
| Log extract | |
| Screenshot / output ref | |
| Raw artifact path / URL | |
| Artifact SHA-256 | |
| Issue / ticket | #43 |
| Pass / Fail | |
| Reviewer (engineering) | |
| Reviewer (plant) | |
| Date | |

## Matrix checklist (aligned IDs)

| ID | Scenario | CI / Bench | Pass? | Notes |
|----|----------|------------|-------|-------|
| HIL-01 | Malformed JSON / non-finite fields | CI | | `hil-packet-matrix` |
| HIL-02 | Missing required fields | CI | | |
| HIL-03 | NaN / infinity numericValue | CI | | |
| HIL-04 | Oversized batch (413 semantics) | CI | | |
| HIL-05 | Out-of-range tagged | CI | | |
| HIL-06 | Negative PV rejected/tagged | CI | | |
| HIL-07 | Stale / delayed device timestamp | CI | | |
| HIL-08 | Future timestamp / skew | CI | | |
| HIL-09 | Unsigned / bad remote config | CI | | |
| HIL-10 | Expired remote config | CI | | |
| HIL-11 | Queue growth under disconnect | CI | | in-memory mirror |
| HIL-12 | Ordered replay after reconnect | CI | | |
| HIL-13 | Reboot queue snapshot survival | CI | | |
| HIL-14 | Invalid signature → 401 + alert | Bench | | also webhook fire-drill |
| HIL-15 | Duplicate nonce / replay | Bench | | |
| HIL-16 | Equal sequence idempotent ACK | Bench | | |
| HIL-17 | Lost LTE / queue growth on device | Bench | | GridFlexEdge USE_LTE=1 |
| HIL-18 | Power-loss LittleFS survival | Bench | | |
| HIL-19 | Redis / DB outage behaviour | Bench | | |
| HIL-20 | Wrong SunSpec register scale | Bench | | worksheet vs meter |
| HIL-21 | Malformed/short/CRC-invalid Modbus frame and unsupported FC | Bench | | capture raw request/response bytes |
| HIL-22 | Watchdog reset and recovery | Bench | | record reset reason, NVS counter and queue recovery |
| HIL-23 | Queue-full refusal without overwrite | Bench | | record alarm/metric and retained sequence range |
| HIL-24 | Remote configuration attempts to enable physical execution | CI + Bench | | server and device must reject |
| HIL-25 | Clock drift and NTP correction | Bench | | record pre/post offset and alert |

## Sign-off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Engineering | | | |
| Plant representative | | | |
