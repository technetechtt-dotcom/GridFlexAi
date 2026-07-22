# Controlled staging pilot execution record

Status: **OPEN** until a complete record is approved by engineering and
operations. Use simulation or isolated test equipment only. Physical command
execution remains disabled throughout.

## Release identity

| Field | Value |
|-------|-------|
| Pilot start / end (UTC) | |
| Environment | staging |
| Git commit SHA | |
| Backend image digest (`sha256:`) | |
| CI run URL / run ID | |
| Evidence manifest path / SHA-256 | |
| Frontend release identifier | |
| Firmware version / binary SHA-256 | |
| Participants and roles | |
| On-call primary / escalation contact | |

## Mandatory safety preflight

- [ ] `PHYSICAL_COMMAND_EXECUTION_ENABLED=false`
- [ ] `HIL_PLANT_APPROVAL_CONFIRMED=false`
- [ ] `PILOT_LOCK_PHYSICAL_EXECUTION=true`
- [ ] Only simulation or isolated, read-only RS485 equipment is connected
- [ ] No FC05/06/0F/10 Modbus traffic is exposed or observed
- [ ] Restore point and rollback digest are recorded
- [ ] Central logs, metrics, alerts and notification routes are healthy
- [ ] Tenant-isolation tests passed for this release
- [ ] Secrets are redacted from every evidence artifact

## Execution sequence

| Step | Start/end UTC | Operator | Result | Raw artifact / URL | SHA-256 |
|------|---------------|----------|--------|--------------------|---------|
| Deploy immutable digest to staging | | | | | |
| Authenticated health/API smoke | | | | | |
| Simulation cross-tenant smoke | | | | | |
| HIL matrix on isolated bench | | | | | |
| Sustained and burst ingestion | | | | | |
| WebSocket fan-out/reconnection | | | | | |
| Redis failure/recovery | | | | | |
| Alert fire drill and acknowledgement | | | | | |
| Restore/rollback rehearsal | | | | | |

## Abort and rollback

Abort immediately for any cross-tenant disclosure, physical-write attempt,
unrecoverable queue corruption, invalid data presented as good quality,
critical alert-delivery failure, or safety-flag drift.

| Threshold | Limit | Observed | Action |
|-----------|-------|----------|--------|
| API 5xx rate | agreed staging SLO | | |
| API/ingest p95 | agreed staging SLO | | |
| WebSocket delivery loss | 0 unauthorized; agreed authorized loss | | |
| Ingest backlog age | alert catalog threshold | | |
| Device offline duration | alert catalog threshold | | |
| Database/Redis saturation | provider limit/guardrail | | |

Rollback digest:  
Rollback start/end (UTC):  
Rollback verification result:

## Incident and alert record

| UTC | Severity | Detection source | Description | Response / ticket | Resolved UTC |
|-----|----------|------------------|-------------|-------------------|--------------|
| | | | | | |

## Approval

| Decision | Name | Role | Signature / ticket | Date |
|----------|------|------|--------------------|------|
| Engineering go / no-go | | | | |
| Operations go / no-go | | | | |
| Security acknowledgement | | | | |

Expansion beyond isolated staging is prohibited unless all P0 evidence links
are present on `evidence-completion-board.md` and both go/no-go decisions are
explicitly **go**.
