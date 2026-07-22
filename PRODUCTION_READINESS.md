# GridFlex Production Readiness Tracker

Use this tracker to move from pilot-ready to production-ready with explicit ownership and evidence.
Do **not** mark ops / plant / POPIA items complete without dated evidence artifacts.
Canonical ledger: [`docs/runbooks/evidence-completion-board.md`](./docs/runbooks/evidence-completion-board.md).
Release candidate: [`docs/releases/RC-2026-07-22.md`](./docs/releases/RC-2026-07-22.md).

## Current Snapshot

- Estimated readiness: **~87% code frameworks**; **ops / plant / external evidence still open**.
- Last updated: **2026-07-22**.
- Release candidate: **`RC-2026-07-22`** at `d1a7363` (floor `b07b817`).
- RC CI: [`29922993173`](https://github.com/technetechtt-dotcom/GridFlexAi/actions/runs/29922993173); manifest SHA-256 `0f7bc5e9a70f35e62ed19e4313b5298731ee8d0bf7a7da587f9ac4488c7f0651`.
- Post-RC green: [`7fd0ba3` CI `29925588915`](https://github.com/technetechtt-dotcom/GridFlexAi/actions/runs/29925588915); signed image [`29929170597`](https://github.com/technetechtt-dotcom/GridFlexAi/actions/runs/29929170597) digest `sha256:1a0f0aa1…4928`.
- Prior floor CI: `b07b817` run `29919025247`, manifest `2b22a9605c44f6ece831b53904d8779eb578cc81529b54d1888f2df9a2cc6707`.
- Canonical layout: frontend `src/`, backend `backend/`, firmware `firmware/GridFlexEdge/`.

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
- [ ] Load soak evidence *(ops)* — k6 live health + restore signed ingest (1 VU) PASS; Redis chaos / staging RPS Open (#50)
- [ ] POPIA IO approval + access review *(governance)* — Open (#48)
- [ ] Telemetry-only staging pilot *(ops)* — Open; physical commands remain disabled

## P2 - Cleanup

- [x] `*.tsbuildinfo` gitignored; CODEOWNERS added
- [x] GitHub issues for every open release blocker *(#43–#50)*
- [x] Duplicate project directory and repository ZIP archive removed; canonical roots only
