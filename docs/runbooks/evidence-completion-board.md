# Evidence completion board (pilot)

This is the canonical release-gate ledger. Other readiness trackers summarize
this board and must not mark a gate complete independently.

All items below stay **Open** until the raw artifact URL/path, SHA-256, target
environment, release commit/image digest, timestamps, owner, reviewer and
approval are recorded. Physical execution remains **disabled** for the initial
pilot (`PILOT_LOCK_PHYSICAL_EXECUTION=true`).

| Gate / issue | Type | Status | Owner / due | Required artifact | Evidence URL + SHA-256 | Reviewer / completed |
|--------------|------|--------|-------------|-------------------|-----------------------|----------------------|
| Simulation tenant isolation | Code P0 | **Done (code/test)** | Engineering | Cross-tenant API + Socket.IO tests on `b512ab5`+ | | |
| Release CI evidence for release SHA | CI P0 | **Done 2026-07-22** | Engineering | Green run on `d68ac65` (supersedes failed `b512ab5`) + evidence manifest | https://github.com/technetechtt-dotcom/GridFlexAi/actions/runs/29916761891 · manifest SHA-256 `577a6212936c42fde5786fea729fadc1be8d0651b9c12c1edf3988ec7aba575a` | Engineering / 2026-07-22 |
| Main required checks | CI P0 | **Configured 2026-07-21** | Repository admin | `security`, `supply-chain`, `frontend`, `firmware`, `backend`, `evidence-manifest`; strict; force-push/delete disabled | GitHub branch protection API | Engineering / 2026-07-21 |
| Physical execution disabled | Safety P0 | **Enforced in code/config; runtime attestation Open** | Ops / every deploy | Flag dump + boot attestation | Live `/api/health` redis+db up 2026-07-22; flags still need deploy attestation dump | |
| Redis replay mandatory (prod) | Security P0 | **Done (code + Render blueprint)** | Engineering | `REDIS_URL` from `gridflex-redis`; `EDGE_REPLAY_REQUIRE_REDIS=true`; `EDGE_ALLOW_MEMORY_REPLAY=false` | `render.yaml` | |
| ESP32-S3 / Waveshare GPIO map approval | Hardware P0 | **Open (desk mismatch recorded)** | Hardware / before wiring | `esp32s3-pin-map-approval.md`, schematic and photos | | |
| Ed25519 device verify + KAT | Hardware P0 | **Code done; flash/bench Open** | Firmware / before HIL | Device KAT log | | |
| SunSpec map on ESP32 Modbus | Hardware P0 | **Code done; hardware Open** | Firmware / issue #44 | Read-only discovery and raw-register comparison | | |
| LTE TLS compile + bench | Hardware P0 | **Open** | Firmware / issue #43 | `lte-tls-bench-worksheet.md` | | |
| Queue power-loss journal | Hardware P0 | **Code done; destructive test Open** | Firmware / issue #43 | Stage-by-stage power-cycle log | | |
| HIL matrix / issue #43 | Hardware P0 | **CI partial; bench Open** | Engineering + plant / before pilot | `hil-evidence-worksheet.md` and raw captures | | |
| Physical inverter / issue #44 | Hardware P0 | **Open** | Installer + EE / before pilot | Dossier, discovery, comparison and sign-off | | |
| Hardware interlock / issue #46 | Plant P0 | **Open** | Plant / before any control consideration | Signed PPC/relay/BMS attestation | | |
| Credential rotation / issue #45 | Provider P0 | **Partial** | Security + ops / before staging | Dry-run on restore branch 2026-07-22: 0 legacy / 0 vaulted device rows; execute + JWT/DB/Redis rotation still Open | | |
| DB restore approver + HTTP smoke | Recovery P0 | **Partial; HTTP smoke and approval Open** | DBA + approver / before staging | Neon `restore-drill-20260722` (`br-wandering-darkness-afxi8rj2`); migrate deploy + `restore:verify` OK; expires 2026-07-29T18:00:00Z | | |
| Observability fire drill / issue #50 | Ops P0 | **Open** | Ops / before staging | Trigger/delivery/ack/clear evidence | | |
| Staging/prod parity promotion | Release P0 | **Open** | Release manager / every promotion | Same `sha256:` digest, migrations, flags and smoke | | |
| Load soak / issue #50 | Performance P1 | **Open** | Engineering / before production | k6/socket JSON and resource graphs | | |
| Supply chain / issue #49 | Security P1 | **Partial** | Security / before production | Immutable pins, scans, signed digest/provenance | | |
| External pen-test / issue #47 | External P1 | **Open** | Independent tester / before production | Report, remediation and retest | | |
| POPIA / issue #48 | Governance P1 | **Open** | Information Officer / before production | Signed policy and first access review | | |
| Controlled staging pilot | Operations P1 | **Open** | Engineering + ops / before scope expansion | `staging-pilot-execution.md` | | |

## Physical execution lock (initial pilot)

Do **not** set `PHYSICAL_COMMAND_EXECUTION_ENABLED` or `HIL_PLANT_APPROVAL_CONFIRMED` to true.
Keep `PILOT_LOCK_PHYSICAL_EXECUTION=true` on Render/staging until plant attestation (#46).
