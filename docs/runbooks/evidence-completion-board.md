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
| Release CI evidence for RC | CI P0 | **Done 2026-07-23 → RC-2026-07-23** | Engineering | `cdcd3e7` required jobs green + manifest | https://github.com/technetechtt-dotcom/GridFlexAi/actions/runs/29988892052 · manifest `37cd37f0…6d72` | Engineering / 2026-07-23 |
| Signed RC image + SBOM | Supply P0 | **Done 2026-07-23** | Engineering | Cosign + OIDC attestations for `rc-2026-07-23` | digest `sha256:accf07fc…c718` · release https://github.com/technetechtt-dotcom/GridFlexAi/actions/runs/30032427639 · release manifest `ac668440…20fb` | Engineering / 2026-07-23 |
| Main branch protection | CI P0 | **Done 2026-07-22** | Engineering | PRs required, ≥1 approval, CODEOWNERS, required checks, enforce_admins, no force-push/delete | `gh api …/branches/main/protection` | Engineering / 2026-07-22 |
| Main required checks | CI P0 | **Configured 2026-07-21** | Repository admin | `security`, `supply-chain`, `frontend`, `firmware`, `backend`, `evidence-manifest`; strict; force-push/delete disabled | GitHub branch protection API | Engineering / 2026-07-21 |
| Physical execution disabled | Safety P0 | **Enforced in code/config; runtime attestation Open** | Ops / every deploy | Flag dump + boot attestation | Live `/api/health` redis+db up 2026-07-22 | |
| Redis replay mandatory (prod) | Security P0 | **Done (code + Render blueprint)** | Engineering | `REDIS_URL` + `EDGE_REPLAY_REQUIRE_REDIS=true` + `EDGE_ALLOW_MEMORY_REPLAY=false` | `render.yaml` | |
| Redis fail-closed chaos (CI) | Security P0 | **Done 2026-07-29 (PR #84)** | Engineering | Jest fail-closed + CI Redis SHUTDOWN probe | `edge-replay-fail-closed.test.ts` + `redis-chaos` job on `main` | Engineering / 2026-07-29 |
| Production forbids SIMULATION | Safety P0 | **Done 2026-07-29 (PR #84)** | Engineering | `ALLOW_SIMULATION_IN_PRODUCTION` gate + Render `PILOT_LIVE` | `env.ts` + `render.yaml` | Engineering / 2026-07-29 |
| Socket.IO Redis fail-closed (prod) | Security P0 | **Done (code/test)** | Engineering | Missing/unreachable Redis aborts production startup | `socket-redis-adapter.ts` + unit tests | |
| ESP32-S3 / Waveshare GPIO map approval | Hardware P0 | **Open — board/revision not confirmed** | Hardware / before wiring | Desk candidate env compile-only; electrical sign-off Open | `esp32s3-pin-map-approval.md` | |
| Ed25519 device verify + KAT | Hardware P0 | **Code done; flash/bench Open** | Firmware / before HIL | Device KAT log | | |
| SunSpec map on ESP32 Modbus | Hardware P0 | **Code done; hardware Open** | Firmware / issue #44 | Read-only discovery and raw-register comparison | | |
| LTE TLS compile + bench | Hardware P0 | **Open** | Firmware / issue #43 | `lte-tls-bench-worksheet.md` | | |
| Queue power-loss journal | Hardware P0 | **Code done; destructive test Open** | Firmware / issue #43 | Stage-by-stage power-cycle log | | |
| HIL matrix / issue #43 | Hardware P0 | **CI partial; bench Open** | Engineering + plant / before pilot | `hil-evidence-worksheet.md` and raw captures | | |
| Physical inverter / issue #44 | Hardware P0 | **Open** | Installer + EE / before pilot | Dossier, discovery, comparison and sign-off | | |
| Hardware interlock / issue #46 | Plant P0 | **Open** | Plant / before any control consideration | Signed PPC/relay/BMS attestation | | |
| Credential rotation / issue #45 | Provider P0 | **Partial** | Security + ops / before staging | AWS CLI installed 2026-08-03; IAM/CMK still missing (4 readiness blockers); restore local vault rehearsal only | SHA-256 `a6314a3ebfacf1c1d9d3014692d0a04f13e791dd418079b5e06c84b14d8eab9e` | |
| DB restore approver + HTTP smoke | Recovery P0 | **Done (engineering attestation 2026-08-03)** | Engineering owner | Neon drills + HTTP smoke; approver `@technetechtt-dotcom` | smoke SHA-256 `57531f57502e6cfe0e7e8458fc36eb374ebe7196f631d9e0e8dd1ccf06edd4bb` | `@technetechtt-dotcom` / 2026-08-03 |
| Observability fire drill / issue #50 | Ops P0 | **Partial** | Ops / before staging | Local webhook PASS; live Render health+db+redis up; metrics unauth→503; **ALERT_WEBHOOK deliver/ack still Open** | SHA-256 `4440732a3e1413a0af3c9d77cfea2188759207b4ce0f2b93ae2a5be8785a11b8` | |
| Staging/prod parity promotion | Release P0 | **Partial — key schema PASS; digest deploy Open** | Release manager / every promotion | Env-parity PASS 70 keys `4814043a…e094`; health can expose `release.imageDigest`; live host still source-built — `staging-rc-digest-deploy.md` | `parity-promotion-evidence.md` | |
| Load soak / issue #50 | Performance P1 | **Partial — health multi-VU Done** | Engineering / before production | Live Render health soak 8 rps: 0% errors, p95 ~513ms (strict 500ms fail; staged ≤2500 pass SHA `a541de00…1276`). Burst 40 rps ~24% fail. Signed ingest + Redis-under-traffic Open (Docker engine 500) | soak-pass `a541de00261515adf3f516f587d36dfdb8482c4ced4bb973c37782cd6f8c1276` | |
| Supply chain / issue #49 | Security P1 | **Partial — RC signed image + HIGH audit policy Done** | Security / before production | Actions SHA pins, Cosign, HIGH fail-closed + exception registry, RC-2026-07-23 digest; staging→prod same-digest still Open | digest `sha256:accf07fc…c718`; PR #84 exception-aware npm audit | Engineering / 2026-07-29 |
| External pen-test / issue #47 | External P1 | **Open — vendor package prep Done (PR #87)** | Independent tester / before production | Auth+scope, RoE, API inventory, test-accounts brief; **signatures / vendor / report still blank** | `docs/pentest/*` | |
| POPIA / issue #48 | Governance P1 | **Partial — export Ready; IO Open** | Information Officer / before production | Privileged export SHA `ac664b53…7d42` (dev DB 2026-08-03); **IO policy + access-review #1 sign-off still Open** | `docs/policies/access-review-log.md` | |
| Controlled staging pilot | Operations P1 | **Partial — identity filled; deploy Open** | Engineering + ops / before scope expansion | `staging-pilot-execution.md` prefilled with RC-2026-07-23 digest; Render deploy still Open | | |

## Physical execution lock (initial pilot)

Do **not** set `PHYSICAL_COMMAND_EXECUTION_ENABLED` or `HIL_PLANT_APPROVAL_CONFIRMED` to true.
Keep `PILOT_LOCK_PHYSICAL_EXECUTION=true` on Render/staging until plant attestation (#46).
