# P0–P2 checklist status (2026-07-22)

Honest status against the release checklist. **Done** = code/docs in repo. **Open** = needs plant, ops, or external party.
Canonical RC: [`../releases/RC-2026-07-22.md`](../releases/RC-2026-07-22.md). Evidence ledger: [`evidence-completion-board.md`](./evidence-completion-board.md).

## P0 — Before any live hardware pilot

| Item | Status | Notes |
|------|--------|-------|
| Simulation WebSocket tenant isolation | Done (code/test) | Persisted organisation/site runs, scoped rooms/emits, cross-tenant tests |
| Release CI evidence | Done | `RC-2026-07-22` @ `d1a7363` run `29922993173`; manifest `0f7bc5e9…0651` (floor `b07b817`) |
| Required checks on `main` | Done (GitHub config) | Strict `security`, `supply-chain`, `frontend`, `firmware`, `backend`, `evidence-manifest` |
| Physical execution disabled | Done | Dual flags + `PILOT_LOCK` + compose — **keep locked** |
| Hardware-level execution interlock | Partial | Software only; plant PPC/relay Open (#46) |
| Redis replay mandatory (prod) | Done | Fail-closed env + runtime |
| Socket.IO Redis fail-closed (prod) | Done | Missing/unreachable Redis aborts production startup |
| Exact Waveshare board + GPIO map | Open | **Not confirmed** — firmware LILYGO 26/27/4 ≠ Waveshare community 17/18; GPIO 25 candidate only |
| LTE AT / TLS flash + bench | Open | Hardware (#43) |
| Physical HIL complete | Open | Bench (#43) |
| Physical inverter E2E | Open | (#44) |
| First device credential + rotation | Partial | Restore local-vault rehearsal Done; prod/staging aws_kms Open (#45) |
| HIL host automated matrix | Partial | CI expanded; physical Open |
| Multi-instance edge replay | Done | Redis mandatory in prod |

## P1 — Before production

| Area | Status |
|------|--------|
| DB restore drill | Partial — verify + HTTP smoke Done 2026-07-22; **approver Open** |
| Logs/metrics/alerting | Partial — unauth probes Done; webhook deliver/ack Open |
| Load soak | Partial — live health baseline PASS; k6 ingest/socket Open (#50) |
| First device credential + rotation | Partial — restore local-vault rehearsal Done; prod aws_kms Open (#45) |
| External pen-test | Open (#47) |
| POPIA IO + access review | Open (#48) |
| Staging/prod parity promotion | Open |
| Telemetry-only staging pilot | Open — physical commands locked |
| Supply-chain signed release evidence | Partial — workflows Done; first signed digest Open |

## P2 — Cleanup

| Item | Status |
|------|--------|
| `*.tsbuildinfo` gitignore | Done |
| CODEOWNERS | Done |
| Canonical dirs documented | Done |
| GitHub issues #43–#50 | Done |

## Hardware interlock statement

GridFlex software interlocks and read-only Modbus **do not** replace plant protection relays, PPC, or BMS.
