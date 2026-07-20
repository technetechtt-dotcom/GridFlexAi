# Vendor register maps (verified only)

## Rule

**Do not invent Modbus addresses.** Every production map must be transcribed from the manufacturer or authorized installer register-map PDF (or NDA package), with provenance fields filled in.

## Layout

```
vendor/<manufacturer>/<model>/<firmware-version>.ts
```

Example (after onboarding):

```
vendor/sungrow/sg250hx/v1-2-3.ts
```

## Onboarding checklist

1. Complete `docs/equipment/pilot-inverter-dossier.md` (manufacturer, model, firmware, comms, map revision, baud/parity/slave ID, signedness, byte order).
2. Copy `_TEMPLATE_/firmware-version.template.ts` to the path above.
3. Replace every `TBD` and every register `address` from the official document.
4. Set `provenanceAttested: true` and `registerMapSource` to the PDF ticket / checksum.
5. Peer-review against the vendor PDF (two-person rule).
6. Wire `resolve-pilot-map.ts` to export the new map.
7. Run HIL validation worksheet (`docs/equipment/inverter-validation-worksheet.md`).
8. Commit fixtures from sanitized HIL captures under `fixtures/` (no plant secrets).

## What is intentionally absent

This repository does **not** currently contain a verified pilot-site inverter map. `resolvePilotVerifiedInverterMap()` fails closed until one is onboarded.
