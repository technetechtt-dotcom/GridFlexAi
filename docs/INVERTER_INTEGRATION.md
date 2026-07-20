# Verified inverter integration (pilot)

## Status

**Adapter + decoder + gates: implemented.**  
**Official pilot-site register map: NOT ONBOARDED** (fails closed — no guessed addresses).

## What you must supply

1. Exact equipment at the pilot site (fill [equipment/pilot-inverter-dossier.md](./equipment/pilot-inverter-dossier.md)):
   - manufacturer, model, firmware, communication module
   - Modbus RTU or TCP; baud/parity/slave ID
   - official register-map version and PDF / NDA source
   - signed/unsigned and byte-order rules from that document
2. Transcribe registers into `backend/src/gateway/maps/vendor/<mfr>/<model>/<fw>.ts`
3. Wire `resolve-pilot-map.ts`
4. Complete HIL worksheet [equipment/inverter-validation-worksheet.md](./equipment/inverter-validation-worksheet.md)

## Architecture

| Piece | Path |
|-------|------|
| `RegisterDefinition` | `backend/src/gateway/verified-inverter/types.ts` |
| Decoder + batching | `verified-inverter/decode.ts` |
| Map loader / attestation gate | `verified-inverter/map-loader.ts` |
| Modbus TCP FC03-only transport | `verified-inverter/modbus-tcp-transport.ts` |
| Read-only adapter + backoff + health | `verified-inverter/adapter.ts` |
| Vendor map slot | `gateway/maps/vendor/` |
| CI fixtures | `backend/tests/verified-inverter.test.ts` |

## Pilot read set (no writes)

Active / reactive power, voltage, current, frequency, daily + lifetime energy, inverter state, alarms/faults, temperature (optional).

`VerifiedReadOnlyInverterAdapter.writePoint` always throws. Transport implements **FC03 only**.

## Acceptance mapping

| Criterion | How it is met |
|-----------|----------------|
| Register map provenance documented | Equipment dossier + `provenanceAttested` / `registerMapSource` on map |
| No guessed addresses | `resolvePilotVerifiedInverterMap()` throws until official map file is added |
| Match reference within tolerances | HIL worksheet (to be filled on site) |
| Network interruptions recover | Exponential reconnect backoff + health metrics |
| No Modbus write in pilot adapter | FC03-only transport + CI source scan + `writePoint` hard-fail |

## Related

- [INDUSTRIAL_GATEWAY.md](./INDUSTRIAL_GATEWAY.md)
- [HARDWARE_IN_THE_LOOP.md](./HARDWARE_IN_THE_LOOP.md)
- [PILOT_DEPLOYMENT.md](./PILOT_DEPLOYMENT.md)
