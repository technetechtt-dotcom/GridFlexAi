# Telemetry-only pilot request (template)

**Title:** GridFlex AI — Northern Cape telemetry-only pilot  
**Mode:** Observation + advisory recommendations only  
**Physical plant execution:** Disabled for the entire pilot window  

## Scope (in)

1. Read-only ingest of inverter / meter / weather telemetry (or agreed CSV / API feed).
2. Curtailment / loss detection with provenance labels (`measured` / `forecast` / `synthetic`).
3. Advisory recovery ranking (flexible load, BESS, hydrogen) with explicit assumptions.
4. Operator-facing evidence pack (HTML/CSV) — no automatic actuation.
5. Weekly review of data quality, false positives, and recommendation usefulness.

## Scope (out)

- No setpoint writes to inverters, BESS, electrolysers, PPC, or relays.
- No claim of realised customer revenue without settlement data.
- No firmware push or credential rotation without separate change control.

## Required inputs from the plant owner

| Item | Why |
|------|-----|
| Plant nameplate (kW/kWp) and export limit | Loss baseline |
| Time-of-use / PPA tariff assumptions (ZAR/kWh) | Commercial ranking |
| Preferred data path (edge node, API, or periodic export) | Provenance |
| Site contact + escalation path | Ops |
| Written confirmation that actuation stays off | Safety |

## Success criteria (pilot)

1. ≥30 consecutive days of telemetry with quality flags.
2. Loss events detected with cause hypotheses and evidence fields.
3. At least one advisory recovery case reviewed by the plant operator.
4. No physical command attempts recorded by the safety gateway.

## Data and POPIA

- Purpose-limited operational data processing.
- Tenant isolation; no cross-customer training without agreement.
- Data retention and deletion on request per Privacy Notice.

## Acceptance signature

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Plant owner / IPP | | | |
| GridFlex pilot lead | | | |
| Safety / engineering | | | |

**Attestation:** Physical execution remains locked (`PILOT_LOCK_PHYSICAL_EXECUTION=true`).
