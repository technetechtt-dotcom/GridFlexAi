# GridFlex Production Readiness Tracker

Use this tracker to move from pilot-ready to production-ready with explicit ownership and evidence.
Do **not** mark ops / plant / POPIA items complete without dated evidence artifacts.

## Current Snapshot

- Estimated readiness: **~84% code frameworks**; **ops / plant / external evidence still open**.
- Last updated: **2026-07-22**.
- Release commit under evidence: **`b512ab5`** (plus follow-up CI/docs/redis hardening commits as they land).
- Canonical layout: frontend `src/`, backend `backend/`, firmware `firmware/GridFlexEdge/`.
- Ops remaining: [`docs/runbooks/ops-completion-pack.md`](./docs/runbooks/ops-completion-pack.md)
- Evidence board: [`docs/runbooks/evidence-completion-board.md`](./docs/runbooks/evidence-completion-board.md)
- Full P0–P2 checklist status: [`docs/runbooks/p0-p2-checklist-status.md`](./docs/runbooks/p0-p2-checklist-status.md)

## P0 - Go-Live Blockers (live hardware pilot)

- [ ] **Required jobs green for the release commit**
  - `bf3ae42` run `29823805508` failed (historical).
  - `b512ab5` run `29915276098` failed `security` on actionlint/shellcheck SC2016 in `release.yml` (fixed in follow-up).
  - Gate remains **Open** until a SHA-bound green CI run + evidence manifest is recorded below.
- [x] **Simulation WebSocket tenant isolation implemented and tested**
  - Persisted organisation/site-owned runs, authorized room joins, scoped emits and cross-tenant tests.
  - Database migration deployment remains part of the release CI/restore gates.
- [x] **Physical execution disabled (backend + deploy + firmware telemetry-only)**
  - Evidence: `PILOT_LOCK_PHYSICAL_EXECUTION`, dual arming flags, `docker-compose.yml`, read-only gateway maps.
  - **Initial pilot: keep locked** — see evidence-completion-board.
- [x] **Redis-backed edge replay mandatory in production**
  - `REDIS_URL` required; `EDGE_REPLAY_REQUIRE_REDIS=true`; `EDGE_ALLOW_MEMORY_REPLAY=false` (env fail-closed).
- [x] **Ed25519 verify on ESP32 + known-answer tests**
  - Evidence: `ed25519_verify.cpp`, boot KAT, `backend/tests/fixtures/ed25519-remote-config-kat.json` + CI.
- [x] **Firmware Modbus uses verified SunSpec Model 103 map**
  - Evidence: `sunspec_model103_map.h` (enable `USE_RS485_MODBUS=1` on bench).
- [x] **Queue journal + dual-meta for power-loss stages**
  - Evidence: `persistent_queue.h`; host `journaled-queue.ts` crash-stage tests.
- [x] **HIL host coverage: CRC, length, delayed, duplicate, disconnect, reset**
  - Evidence: `ed25519-kat-and-modbus-hil.test.ts`, `hil-packet-matrix` HIL-16…18.
- [ ] **Exact Waveshare / production board GPIO map verified** *(HW)* — desk review shows firmware LILYGO pins ≠ Waveshare community map; see `esp32s3-pin-map-approval.md`.
- [ ] **LTE TLS compile + bench on ESP32-S3/SIM7670** *(ops/HW)* — ESP32-S3 CI profile added; physical bench evidence remains open.
- [ ] **Hardware-level plant interlock wiring / PPC attestation** *(ops/plant)*
- [ ] **Physical inverter validation + engineering sign-off** *(ops)* — issue #44
- [ ] **Credential rotation + revocation rehearsal documented** *(ops)* — `credential-rotation-rehearsal.md`
## P1 - Before production

- [ ] Restore drill approver + HTTP smoke *(ops)*
- [ ] Central log drain + alert fire-drill *(ops)*
- [ ] Staging→prod digest promotion evidence *(ops)*
- [ ] External pen-test engagement closed *(external)*
- [x] Actions SHA pins + image signing workflow *(code)* — immutable Action pins, SBOM, CodeQL/dependency review, GHCR provenance and keyless Cosign are implemented; first signed release evidence remains open.
- [ ] Load soak evidence worksheet *(ops)*
- [ ] POPIA IO review *(governance)*
- [ ] Telemetry-only staging pilot record *(ops)* — `staging-pilot-execution.md`; physical command execution remains disabled

## P2 - Cleanup

- [x] `*.tsbuildinfo` gitignored; CODEOWNERS added
- [x] GitHub issues for every open release blocker *(#43–#50)*
- [x] Duplicate project directory and repository ZIP archive removed; canonical roots only
