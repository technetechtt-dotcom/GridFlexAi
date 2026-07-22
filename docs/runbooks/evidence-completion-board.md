# Evidence completion board (pilot)

This is the canonical release-gate ledger. Other readiness trackers summarize
this board and must not mark a gate complete independently.

All items below stay **Open** until the raw artifact URL/path, SHA-256, target
environment, release commit/image digest, timestamps, owner, reviewer and
approval are recorded. Physical execution remains **disabled** for the initial
pilot (`PILOT_LOCK_PHYSICAL_EXECUTION=true`).

| Gate / issue | Type | Status | Owner / due | Required artifact | Evidence URL + SHA-256 | Reviewer / completed |
|--------------|------|--------|-------------|-------------------|-----------------------|----------------------|
| Simulation tenant isolation | Code P0 | **Done (code/test)** | Engineering | Cross-tenant API + Socket.IO tests | | |
| Release CI evidence for RC | CI P0 | **Done 2026-07-22** | Engineering | `RC-2026-07-22` @ `d1a7363` + floor `b07b817` | https://github.com/technetechtt-dotcom/GridFlexAi/actions/runs/29922993173 · manifest `0f7bc5e9a70f35e62ed19e4313b5298731ee8d0bf7a7da587f9ac4488c7f0651` | Engineering / 2026-07-22 |
| Main required checks | CI P0 | **Configured 2026-07-21** | Repository admin | `security`, `supply-chain`, `frontend`, `firmware`, `backend`, `evidence-manifest`; strict; force-push/delete disabled | GitHub branch protection API | Engineering / 2026-07-21 |
| Physical execution disabled | Safety P0 | **Enforced in code/config; runtime attestation Open** | Ops / every deploy | Flag dump + boot attestation | Live `/api/health` redis+db up 2026-07-22 | |
| Redis replay mandatory (prod) | Security P0 | **Done (code + Render blueprint)** | Engineering | `REDIS_URL` + `EDGE_REPLAY_REQUIRE_REDIS=true` + `EDGE_ALLOW_MEMORY_REPLAY=false` | `render.yaml` | |
| Socket.IO Redis fail-closed (prod) | Security P0 | **Done (code/test)** | Engineering | Missing/unreachable Redis aborts production startup | `socket-redis-adapter.ts` + unit tests | |
| ESP32-S3 / Waveshare GPIO map approval | Hardware P0 | **Open — board/revision not confirmed** | Hardware / before wiring | Desk candidate env compile-only; electrical sign-off Open | `esp32s3-pin-map-approval.md` | |
| Ed25519 device verify + KAT | Hardware P0 | **Code done; flash/bench Open** | Firmware / before HIL | Device KAT log | | |
| SunSpec map on ESP32 Modbus | Hardware P0 | **Code done; hardware Open** | Firmware / issue #44 | Read-only discovery and raw-register comparison | | |
| LTE TLS compile + bench | Hardware P0 | **Open** | Firmware / issue #43 | `lte-tls-bench-worksheet.md` | | |
| Queue power-loss journal | Hardware P0 | **Code done; destructive test Open** | Firmware / issue #43 | Stage-by-stage power-cycle log | | |
| HIL matrix / issue #43 | Hardware P0 | **CI partial; bench Open** | Engineering + plant / before pilot | `hil-evidence-worksheet.md` and raw captures | | |
| Physical inverter / issue #44 | Hardware P0 | **Open** | Installer + EE / before pilot | Dossier, discovery, comparison and sign-off | | |
| Hardware interlock / issue #46 | Plant P0 | **Open** | Plant / before any control consideration | Signed PPC/relay/BMS attestation | | |
| Credential rotation / issue #45 | Provider P0 | **Partial** | Security + ops / before staging | Restore provision+rotate Done (local vault); staging/prod aws_kms **blocked** (no AWS CLI/keys on workstation) | SHA-256 `a6314a3ebfacf1c1d9d3014692d0a04f13e791dd418079b5e06c84b14d8eab9e` | |
| DB restore approver + HTTP smoke | Recovery P0 | **Partial; approver Open** | DBA + approver / before staging | Neon `restore-drill-20260722`; migrate + verify + authenticated HTTP smoke OK | smoke SHA-256 `57531f57502e6cfe0e7e8458fc36eb374ebe7196f631d9e0e8dd1ccf06edd4bb` | |
| Observability fire drill / issue #50 | Ops P0 | **Partial** | Ops / before staging | Live probes Done; local webhook dispatcher PASS (`c50405a5…b4b5`); Render `ALERT_WEBHOOK_*` deliver/ack still Open | SHA-256 `c50405a5897c98fb564fabf43511d2a2cc598b2d72376d76eed449030dceb4b5` | |
| Staging/prod parity promotion | Release P0 | **Open** | Release manager / every promotion | Same `sha256:` digest, migrations, flags and smoke | first signed image digest recorded below — parity still Open | |
| Load soak / issue #50 | Performance P1 | **Partial** | Engineering / before production | k6 live health PASS; signed restore ingest 5/5 PASS (1 VU); fan-out/reconnect PASS; Redis chaos Open (Docker Desktop API unstable) | health `5e66d876…c1bd`; signed ingest `374276c33c964b395d8057e3fbc5d8cd49dee39c26c1b0c6e81074957b8a4405` | |
| Supply chain / issue #49 | Security P1 | **Partial — first signed image Done** | Security / before production | GHCR digest + SBOM + OIDC attestations + Cosign | run `29929170597`; digest `sha256:1a0f0aa1c724c026732951b5868ec9941e3b19638150c01baee6f8a27ed24928`; manifest `a620d200…a302` | Engineering / 2026-07-22 |
| External pen-test / issue #47 | External P1 | **Open** | Independent tester / before production | Report, remediation and retest | | |
| POPIA / issue #48 | Governance P1 | **Open** | Information Officer / before production | Signed policy and first access review | | |
| Controlled staging pilot | Operations P1 | **Open** | Engineering + ops / before scope expansion | `staging-pilot-execution.md` | | |

## Physical execution lock (initial pilot)

Do **not** set `PHYSICAL_COMMAND_EXECUTION_ENABLED` or `HIL_PLANT_APPROVAL_CONFIRMED` to true.
Keep `PILOT_LOCK_PHYSICAL_EXECUTION=true` on Render/staging until plant attestation (#46).
