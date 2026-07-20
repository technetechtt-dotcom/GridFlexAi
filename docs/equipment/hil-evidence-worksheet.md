# HIL evidence worksheet

Complete one row per Phase 6 matrix case. Sign-off requires engineering + plant representative.

| Field | Value |
|-------|-------|
| Test identifier | |
| Firmware version | |
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

## Matrix checklist

| ID | Scenario | Pass? | Notes |
|----|----------|-------|-------|
| HIL-01 | Malformed JSON | | |
| HIL-02 | Missing field | | |
| HIL-03 | Invalid signature | | |
| HIL-04 | Old auth timestamp | | |
| HIL-05 | Duplicate nonce | | |
| HIL-06 | Duplicate sequence (idempotent) | | |
| HIL-07 | Delayed data → stale | | |
| HIL-08 | Future timestamp | | |
| HIL-09 | Excess / out-of-range | | |
| HIL-10 | Negative PV | | |
| HIL-11 | NaN / infinity | | |
| HIL-12 | Oversized payload | | |
| HIL-13 | Rate limit 429 | | |
| HIL-14 | Lost LTE / queue growth | | |
| HIL-15 | Reconnect ordered replay | | |
| HIL-16 | Power loss queue survival | | |
| HIL-17 | Redis outage behaviour | | |
| HIL-18 | Database outage → retain | | |
| HIL-19 | Clock drift correction | | |
| HIL-20 | Wrong register scale | | |

## Sign-off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Engineering | | | |
| Plant representative | | | |
