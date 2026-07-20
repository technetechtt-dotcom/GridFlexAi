# HIL evidence worksheet

Complete one row per matrix case. Sign-off requires engineering + plant representative.  
**CI packet suite** (`backend/tests/hil-packet-matrix.test.ts`) covers schema/queue cases on host — mark “CI” in Notes when that is the evidence source. Hardware rows still require bench.

| Field | Value |
|-------|-------|
| Test identifier | |
| Firmware version | 5.1.0-edge-4g-sequenced (or later) |
| Backend commit | |
| Hardware serial number | |
| Setup | |
| Expected result | |
| Actual result | |
| Log extract | |
| Screenshot / output ref | |
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

## Sign-off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Engineering | | | |
| Plant representative | | | |
