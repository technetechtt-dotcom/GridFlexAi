# Controlled staging pilot execution record

Status: **OPEN** — release identity and safety defaults are fixed; **deploy and
operator steps remain blank** until Render staging receives the signed RC
digest and ops completes the sequence below.

Use simulation or isolated test equipment only. Physical command execution
remains disabled throughout.

## Release identity

| Field | Value |
|-------|-------|
| Pilot start / end (UTC) | _pending — start when digest is live on staging_ |
| Environment | staging |
| Git commit SHA | `cdcd3e7ae2b5962ba58f990f3249728b164ab560` (`RC-2026-07-23`) |
| Backend image digest (`sha256:`) | `sha256:accf07fc8326ffa15dd4df647af3175bb36b2d9b587270234247324c7e57c718` (signed; **staging deploy still Open**) |
| CI run URL / run ID | https://github.com/technetechtt-dotcom/GridFlexAi/actions/runs/29988892052 |
| Evidence manifest path / SHA-256 | `37cd37f0b13d39550be465a29c93d34bc0d4cdba5e49274a5a8792e8d8916d72` |
| Frontend release identifier | _pending staging frontend deploy id_ |
| Firmware version / binary SHA-256 | see CI firmware-evidence artifact on freeze run |
| Participants and roles | Engineering owner `@technetechtt-dotcom` (deploy/ops lead TBD) |
| On-call primary / escalation contact | _pending named ops on-call_ |
| Rollback digest (previous staging) | _record before deploy; must not be `d1a7363` / RC-2026-07-22_ |

## Mandatory safety preflight

- [x] `PHYSICAL_COMMAND_EXECUTION_ENABLED=false` (blueprint + code default)
- [x] `HIL_PLANT_APPROVAL_CONFIRMED=false` (blueprint + code default)
- [x] `PILOT_LOCK_PHYSICAL_EXECUTION=true` (blueprint + code default)
- [ ] Only simulation or isolated, read-only RS485 equipment is connected
- [ ] No FC05/06/0F/10 Modbus traffic is exposed or observed
- [ ] Restore point and rollback digest are recorded
- [ ] Central logs, metrics, alerts and notification routes are healthy
- [x] Tenant-isolation tests passed for this release (CI backend tests)
- [ ] Secrets are redacted from every evidence artifact
- [x] Authenticated HTTP smoke against restore/staging target (2026-07-22 restore-drill SHA-256 `57531f57…d4bb`)
- [ ] Waveshare/board pin map signed before any RS485 energize
- [x] Approver sign-off on restore drill (engineering owner `@technetechtt-dotcom`, 2026-08-03 — see `backup-restore-evidence.md`)
- [ ] Alert webhook delivery/ack fire-drill with `METRICS_SCRAPE_TOKEN` + `ALERT_WEBHOOK_*` **on Render staging**
- [x] Env key schema parity includes alert/metrics keys (PR #87; `check:env-parity` PASS, schema `a8f7e560…158b`)

## Execution sequence

| Step | Start/end UTC | Operator | Result | Raw artifact / URL | SHA-256 |
|------|---------------|----------|--------|--------------------|---------|
| Deploy immutable digest to staging | | | **Open** — needs Render image pin to `sha256:accf07fc…c718` | | |
| Authenticated health/API smoke | | | | | |
| Simulation cross-tenant smoke | | | | | |
| HIL matrix on isolated bench | | | | | |
| Sustained and burst ingestion | 2026-08-03 | Engineering | **Partial** — health multi-VU only (not signed ingest) | `go-live-reports/k6-staging-health-soak-pass.json` | `a541de00261515adf3f516f587d36dfdb8482c4ced4bb973c37782cd6f8c1276` |
| WebSocket fan-out/reconnection | | | | | |
| Redis failure/recovery | | | **Open** — Docker Desktop engine returning 500 locally | | |
| Alert fire drill and acknowledgement | | | local dispatcher PASS `4440732a…a11b8`; Render Open | | |
| Restore/rollback rehearsal | | | Neon restore drills Done; see backup-restore evidence | | |

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
