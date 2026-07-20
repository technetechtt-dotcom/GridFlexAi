# P0–P2 checklist status (2026-07-20)

Honest status against the release checklist. **Done** = code/docs in repo. **Open** = needs plant, ops, or external party.

## P0 — Before any live hardware pilot

| Item | Status | Notes |
|------|--------|-------|
| Physical execution disabled (backend/firmware/deploy) | Done | Dual flags + `PILOT_LOCK` + compose |
| Hardware-level execution interlock | Partial | Software interlocks only; plant PPC/relay Open |
| Remote config cannot enable physical execution | Done | Server + firmware reject control fields |
| Operating mode prominent in UI | Done | `OperatingModeBanner` |
| Audit-log blocked control attempts | Done | `command.blocked` / `physical_execution_blocked` |
| LTE uses modem TLS (not Wi-Fi TLS on LTE path) | Done | `beginHttps` + SSLClient |
| Cert-validated TLS over LTE | Done (code) | Needs bench validate with SSLClient lib |
| Wi-Fi↔LTE failover | Done (code) | Bench HIL-17 Open |
| Real RS485/Modbus (no random) | Done (code) | `USE_RS485_MODBUS=1` on hardware; fail-closed when 0 |
| LittleFS/queue fail-safe | Done | Skip enqueue on mount fail |
| Power-loss safe queue writes | Partial | tmp+rename; short remove-before-rename window remains |
| Queue recovery after resets | Partial | Rebuild restores head/tail; stage-by-stage bench Open |
| Watchdog network/Modbus/FS | Partial | TWDT + NVS counters; FS hang probe limited |
| Reset/WDT to backend | Done | Telemetry fields + NVS |
| Remote config auth/sign/validate/rollback/report | Partial | Pull wired; Ed25519 needs `MBEDTLS_ED25519_C` on board |
| SunSpec discovery at adapter startup | Done | `PILOT_SUNSPEC_DISCOVER=true` |
| Identity Mn/Md/SN + reject unexpected | Done | Env `PILOT_INVERTER_EXPECTED_MN/MD` |
| Auto-include SF in partial reads | Done | `expandKeysWithScaleFactors` |
| Sentinels / SF range | Done | Model 103 `unavailableRaw`; SF ±10 gate |
| Stale/timeout behaviour | Partial | Transport timeouts; worksheet Open |
| Physical inverter + installer sign-off | Open | |
| No false daily energy | Done | Lifetime WH only |
| Credential inventory / remove from source | Partial | Inventory TBD dates; hygiene CI |
| Managed secret store + per-device keys | Done (code) | KMS vault + GRIDFLEX-V1 |
| KMS-backed **signing** (SignCommand) | Open / deferred | Design: HMAC on device secret; KMS encrypts secret at rest |
| Canonical serialize + body hash + seq | Done | |
| Multi-instance replay | Partial | Redis required in prod |
| Revocation + rotation evidence | Partial | Code Done; rotation log Open |
| HIL automated matrix | Partial | Host CI expanded; Modbus CRC/wire + bench Open |

## P1 — Before production

| Area | Status |
|------|--------|
| DB restore drill | Partial (verify OK; approver Open) |
| Logs/metrics/alerting live | Partial (code Done; drain/fire-drill Open) |
| Staging/prod parity | Partial (check script Done; promotion evidence Open) |
| External pen-test | Open |
| Supply-chain SHA pins / cosign / HIGH fail | Partial (CycloneDX pinned; Trivy CRITICAL fail) |
| Performance soak evidence | Open |
| POPIA IO approval | Open |

## P2 — Cleanup

| Item | Status |
|------|--------|
| `*.tsbuildinfo` gitignore | Done |
| CODEOWNERS | Done |
| Canonical dirs documented | Done |
| GitHub issues for open blockers | Done — #43–#50 |
| Duplicate dir / ZIP purge | Confirm locally before delete |

## Filed issues (2026-07-20)

- https://github.com/technetechtt-dotcom/GridFlexAi/issues/43 — Physical HIL + Modbus wire fuzz
- https://github.com/technetechtt-dotcom/GridFlexAi/issues/44 — Physical inverter + installer sign-off
- https://github.com/technetechtt-dotcom/GridFlexAi/issues/45 — Credential rotation evidence
- https://github.com/technetechtt-dotcom/GridFlexAi/issues/46 — Plant hardware interlock attestation
- https://github.com/technetechtt-dotcom/GridFlexAi/issues/47 — External pen-test
- https://github.com/technetechtt-dotcom/GridFlexAi/issues/48 — POPIA IO review
- https://github.com/technetechtt-dotcom/GridFlexAi/issues/49 — Supply-chain SHA pins / cosign / HIGH
- https://github.com/technetechtt-dotcom/GridFlexAi/issues/50 — Load soak + monitoring fire-drill

## Hardware interlock statement

GridFlex software interlocks and read-only Modbus **do not** replace plant protection relays, PPC, or BMS. A hardware execution interlock (dry contact / PPC inhibit) must be attested before any physical command path is considered.
