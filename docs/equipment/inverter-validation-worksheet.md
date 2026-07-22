# Inverter HIL validation worksheet

Compare inverter screen / calibrated meter vs Modbus raw vs GridFlex engineering value.  
Agreed default tolerances (override per site): power ±1% or ±2 kW; frequency ±0.02 Hz; energy ±1%.

| Evidence field | Value |
|----------------|-------|
| Environment / bench ID | |
| Commit / firmware SHA | |
| Inverter manufacturer / model / serial | |
| SunSpec discovery output path / SHA-256 | |
| Packet capture path / SHA-256 | |
| Start / end timestamps (UTC) | |
| Issue / ticket | #44 |

| Signal | Inverter screen / meter | Modbus raw | GridFlex value | Tolerance | Result | Notes |
|--------|-------------------------|------------|----------------|-----------|--------|-------|
| Active power | | | | ±1% / ±2 kW | Pass / Fail | |
| Reactive power | | | | | Pass / Fail | |
| Voltage | | | | | Pass / Fail | |
| Current | | | | | Pass / Fail | |
| Frequency | | | | ±0.02 Hz | Pass / Fail | |
| Daily energy | | | | ±1% | Pass / Fail | |
| Lifetime energy | | | | ±1% | Pass / Fail | |
| Inverter state | | | | exact | Pass / Fail | |
| Alarm / fault | | | | exact | Pass / Fail | |
| Temperature | | | | ±2 °C | Pass / Fail | |

## Network interruption recovery

| Test | Procedure | Expected | Result |
|------|-----------|----------|--------|
| Link down | Unplug Ethernet / serial for 30s | Adapter reconnects with backoff; health shows failures then recovery | |
| Timeout | Induce delay > timeoutMs | Read fails cleanly; next poll recovers | |

## Write-function confirmation

Confirm Modbus capture / code review shows **only FC03** (or FC04 if input registers are used later). No FC05/06/0F/10 in the pilot adapter.

| Check | Result |
|-------|--------|
| Code review: no write FC in `verified-inverter/` | |
| Packet capture: no write FC during HIL | |

## Sign-off

| Role | Name | Date |
|------|------|------|
| Test engineer | | |
| Reviewer | | |
| Authorized installer / electrical engineer | | |
