# Plant hardware interlock attestation

Status: **OPEN — issue #46 requires plant and electrical-engineer approval.**

GridFlex software flags and read-only pilot adapters do not replace the plant
PPC, protection relay, contactor or BMS. This form records the independent
physical mechanism that prevents GridFlex from actuating plant equipment.

## Plant and design identity

| Field | Value |
|-------|-------|
| Organisation / site | |
| Plant / asset | |
| Single-line diagram revision | |
| PPC / relay / BMS manufacturer and model | |
| Interlock type (dry contact, inhibit input, hardwired relay, other) | |
| Normal/fail-safe state | |
| Isolation boundary | |
| Wiring drawing path / SHA-256 | |
| Panel/terminal photos path / SHA-256 | |
| Test procedure / work permit | |
| Issue / ticket | #46 |

## Verification

| Test | Expected | Observed / artifact | Pass? |
|------|----------|---------------------|-------|
| GridFlex execution flags false/false; pilot lock true | No command reaches equipment | | |
| Loss of GridFlex edge power | Interlock remains safe | | |
| Loss of network/backend | Interlock remains safe | | |
| Attempted software command while inhibited | Physically blocked and audited | | |
| PPC/relay/BMS trip | Independent protection operates | | |
| Reset/restart | Does not silently arm | | |

## Attestation

We confirm that the described interlock is independent of GridFlex application
software, is fail-safe for the approved pilot mode, and was tested under an
authorized work permit.

| Role | Name / registration | Signature / ticket | Date |
|------|---------------------|--------------------|------|
| Plant representative | | | |
| Authorized installer | | | |
| Electrical engineer | | | |
| GridFlex engineering witness | | | |
