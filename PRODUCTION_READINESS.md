# GridFlex Production Readiness Tracker

Use this tracker to move from pilot-ready to production-ready with explicit ownership and evidence.
Do **not** mark ops / plant / POPIA items complete without dated evidence artifacts.
Canonical ledger: [`docs/runbooks/evidence-completion-board.md`](./docs/runbooks/evidence-completion-board.md).
Active release candidate: [`docs/releases/RC-2026-07-23.md`](./docs/releases/RC-2026-07-23.md) (supersedes [`RC-2026-07-22B`](./docs/releases/RC-2026-07-22B.md) / [`RC-2026-07-22`](./docs/releases/RC-2026-07-22.md)).

## Current local assessment — 2026-10-21

- Active working source: `Grid Flex/` under the outer workspace, with frontend `src/`, backend `backend/`, and firmware `firmware/GridFlexEdge/`.
- Local remediation: [`docs/releases/LOCAL-2026-10-21.md`](./docs/releases/LOCAL-2026-10-21.md).
- Reproduce code verification with `npm run verify:local`; the exact-source result is recorded in `go-live-reports/local-verification.json`.
- Production readiness is **not established**. No percentage is assigned: hardware, deployment, operations and external sign-offs require separate evidence.
- The evidence board remains the canonical operational ledger. Historical release and CI entries below do not validate the current uncommitted source or its deployed state.
- The former `RC-2026-07-23` record and its signed image are historical references, not a release identity for this remediation.

## P0 - Go-Live Blockers (live hardware pilot)

- [x] **Required jobs green for a release SHA ≥ `b07b817`**
  - RC freeze: [`d1a7363` run `29922993173`](https://github.com/technetechtt-dotcom/GridFlexAi/actions/runs/29922993173); manifest `0f7bc5e9a70f35e62ed19e4313b5298731ee8d0bf7a7da587f9ac4488c7f0651`.
  - Floor: [`b07b817` run `29919025247`](https://github.com/technetechtt-dotcom/GridFlexAi/actions/runs/29919025247).
- [x] **Simulation WebSocket tenant isolation implemented and tested**
- [x] **Physical execution disabled (backend + deploy + firmware telemetry-only)** — keep locked for initial pilot.
- [x] **Redis-backed edge replay mandatory in production**
- [x] **Socket.IO Redis fail-closed in production** — missing/unreachable Redis aborts startup.
- [x] **Ed25519 verify on ESP32 + known-answer tests** (code/CI; board flash Open)
- [x] **Firmware Modbus uses verified SunSpec Model 103 map** (code; hardware Open)
- [x] **Queue journal + dual-meta for power-loss stages** (code; destructive bench Open)
- [x] **HIL host coverage** (CI partial; physical bench Open)
- [ ] **Exact Waveshare / production board GPIO map verified** *(HW)* — **not confirmed**; unsigned compile candidate only.
- [ ] **LTE AT / TLS flash + bench validate** *(HW)* — Open (#43)
- [ ] **Physical HIL complete** *(HW)* — Open (#43)
- [ ] **Hardware-level plant interlock / PPC attestation** *(plant)* — Open (#46)
- [ ] **Physical inverter validation + engineering sign-off** *(ops)* — Open (#44)
- [ ] **First device credential provision + rotation evidence** *(ops)* — restore local-vault rehearsal Done (`a6314a3e…`); **staging/prod aws_kms blocked** (no AWS CLI/keys on workstation) (#45).
- Git tag: `rc-2026-07-22` → `d1a7363`
- First signed GHCR image @ `7fd0ba3`: digest `sha256:1a0f0aa1c724c026732951b5868ec9941e3b19638150c01baee6f8a27ed24928` (Cosign + OIDC attestations).

## P1 - Before production

- [ ] Restore drill **approver** *(ops)* — verify + HTTP smoke Done 2026-07-22; approver Open
- [ ] Central log drain + alert webhook fire-drill *(ops)* — local dispatcher PASS (`c50405a5…`); Render `ALERT_WEBHOOK_*` deliver/ack Open
- [ ] Staging→prod digest promotion evidence *(ops)* — first signed digest exists; parity promotion Open
- [ ] External pen-test engagement closed *(external)* — Open (#47)
- [x] Actions SHA pins + image signing workflow *(code)*; **first signed release image Done** @ `7fd0ba3`
- [ ] Load soak evidence *(ops)* — k6 live health + restore signed ingest (1 VU) PASS; Redis fail-closed CI Done (PR #84); staging multi-device RPS Open (#50)
- [ ] AWS KMS vault + credential rotation *(ops)* — dry-run `npm run verify:kms-readiness`; blocked on AWS CLI/keys (#45)
- [ ] See `docs/runbooks/platform-unblock-checklist.md` for remaining unlock order
- [ ] POPIA IO approval + access review *(governance)* — Open (#48)
- [ ] Telemetry-only staging pilot *(ops)* — Open; physical commands remain disabled

## P2 - Cleanup

- [x] `*.tsbuildinfo` gitignored; CODEOWNERS added
- [x] GitHub issues for every open release blocker *(#43–#50)*
- [ ] Workspace archive consolidation: sibling working copies and ZIP remain; active source is explicitly identified in the outer README. Preserve unique work before removal.
