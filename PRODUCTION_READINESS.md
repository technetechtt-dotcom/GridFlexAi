# GridFlex Production Readiness Tracker

Use this tracker to move from pilot-ready to production-ready with explicit ownership and evidence.
Do **not** mark ops / plant / POPIA items complete without dated evidence artifacts.

## Current Snapshot

- Estimated readiness: **~75% code frameworks**; **ops / plant / external evidence still open**.
- Last updated: **2026-07-20**.
- Canonical layout: frontend `src/`, backend `backend/`, firmware `firmware/GridFlexEdge/`.
- Ops remaining: [`docs/runbooks/ops-completion-pack.md`](./docs/runbooks/ops-completion-pack.md)
- Full P0–P2 checklist status: [`docs/runbooks/p0-p2-checklist-status.md`](./docs/runbooks/p0-p2-checklist-status.md)

## P0 - Go-Live Blockers (live hardware pilot)

- [x] **CI required jobs green on `main`**
  - Evidence: https://github.com/technetechtt-dotcom/GridFlexAi/actions/runs/29742647245
- [x] **Physical execution disabled (backend + deploy + firmware telemetry-only)**
  - Evidence: `PILOT_LOCK_PHYSICAL_EXECUTION`, dual arming flags, `docker-compose.yml`, read-only gateway maps.
- [x] **Remote config cannot enable physical execution**
  - Evidence: `edge-remote-config.service.ts` forbidden keys + firmware reject of control fields.
- [x] **Operating mode banner (simulation / HIL / advisory / live)**
  - Evidence: `OperatingModeBanner.tsx` sticky + watermark.
- [x] **Audit-log blocked control attempts**
  - Evidence: `command.service.ts` `auditBlockedAttempt` on override/plant/physical blocks.
- [x] **LTE upload uses modem TLS client (not Wi-Fi TLS while LTE active)**
  - Evidence: `network_manager.h` `beginHttps` path selection + SSLClient.
- [x] **Modbus acquisition path (fail-closed; no random fabricate)**
  - Evidence: `modbus_rtu.h` + `USE_RS485_MODBUS` (enable on hardware).
- [x] **LittleFS/queue fail-safe + atomic meta/slot writes + rebuild head**
  - Evidence: `persistent_queue.h`; enqueue skipped when mount fails.
- [x] **Watchdog NVS counters + reset reason in telemetry**
  - Evidence: `watchdog_health.h` Preferences persistence.
- [x] **SunSpec discovery hook + SF auto-include + sentinels**
  - Evidence: adapter `discoverSunSpec`, `expandKeysWithScaleFactors`, Model 103 `unavailableRaw`.
- [ ] **Hardware-level plant interlock wiring / PPC attestation** *(ops/plant)*
- [ ] **Physical HIL HIL-14…20 + Modbus wire fuzz on bench** *(ops)*
- [ ] **Physical inverter integration + installer sign-off** *(ops)*
- [ ] **Secrets rotated after redesign + rotation log evidence** *(ops)*
- [ ] **KMS SignCommand protocol** *(design decision: device HMAC + KMS vault today — see checklist)* 

## P1 - Before production

- [ ] Restore drill approver + HTTP smoke *(ops)*
- [ ] Central log drain + alert fire-drill *(ops)*
- [ ] Staging→prod digest promotion evidence *(ops)*
- [ ] External pen-test engagement closed *(external)*
- [ ] Actions SHA pins + image signing *(eng)*
- [ ] Load soak evidence worksheet *(ops)*
- [ ] POPIA IO review *(governance)*

## P2 - Cleanup

- [x] `*.tsbuildinfo` gitignored; CODEOWNERS added
- [ ] GitHub issues for every open release blocker *(see checklist)*
- [ ] Confirm no duplicate project directories / unique ZIP content before purge
