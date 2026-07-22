# Pilot inverter equipment dossier

> Status: **NOT ONBOARDED** — fill from the unit actually installed at the pilot site.  
> Do not invent values. Leave fields blank until verified with the manufacturer / authorized installer.

## Equipment identity

| Field | Value | Source |
|-------|-------|--------|
| Manufacturer | _TBD_ | Nameplate / purchase order |
| Model | _TBD_ | Nameplate |
| Serial number | _TBD_ | Nameplate + SunSpec discovery |
| Firmware version | _TBD_ | Inverter HMI / installer report |
| Communication module | _TBD_ | e.g. COM100 / logger / PLC gateway |
| Transport | Modbus RTU / Modbus TCP | Installer network drawing |
| Official register-map version | _TBD_ | Vendor PDF revision |
| Register-map document | _TBD path / NDA ticket_ | Manufacturer or authorized installer |
| Baud rate | _TBD (RTU)_ | Commissioning sheet |
| Parity | none / even / odd | Commissioning sheet |
| Stop bits | 1 / 2 | Commissioning sheet |
| Slave / unit ID | _TBD_ | Commissioning sheet |
| Signed / unsigned rules | _TBD_ | Vendor map §… |
| Byte / word order | _TBD (ABCD / CDAB / …)_ | Vendor map §… |

## Validation evidence

| Field | Value |
|-------|-------|
| Environment / isolated bench ID | |
| Backend commit SHA | |
| Firmware version / binary SHA-256 | |
| Test start / end (UTC) | |
| SunSpec discovery raw artifact | |
| Raw artifact SHA-256 | |
| Discovered manufacturer / model / serial | |
| Nameplate comparison | pass / fail |
| Read-only RS485 isolation method | |
| Packet capture path / SHA-256 | |
| Validation worksheet path / SHA-256 | |
| Issue / ticket | #44 |

## Pilot read set (no writes)

- Active power
- Reactive power
- Phase or line voltage
- Current
- Frequency
- Daily energy
- Lifetime energy
- Inverter state
- Alarms / faults
- Temperature (if available)

## Approvals

| Role | Name | Date | Signature / ticket |
|------|------|------|--------------------|
| Transcriber | | | |
| Peer reviewer (vs vendor PDF) | | | |
| Plant / IPP representative | | | |

## Map file

Once filled: `backend/src/gateway/maps/vendor/<manufacturer>/<model>/<firmware>.ts`  
Wire: `backend/src/gateway/maps/vendor/resolve-pilot-map.ts`
