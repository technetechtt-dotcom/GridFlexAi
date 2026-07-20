# Pilot deployment

Stay in observe + advise mode.

## Hard safety controls

1. `PHYSICAL_COMMAND_EXECUTION_ENABLED=false` in all pilot environments.
2. `HIL_PLANT_APPROVAL_CONFIRMED=false` in all pilot environments.
3. Production startup rejects physical actuation unless **both** flags are explicitly `true`.
4. GridFlex does **not** replace protection relays, PPC safety, or BMS protection.
5. `REDIS_URL` configured for Socket.IO adapter and edge replay protection.
6. Keep retention purge off until policy sign-off.
7. Deploy migration `20260719210000_pr5_alarms_incidents`.

## Pre-pilot completion gates

The following gates must be complete and evidenced before a real IPP pilot.

1. **Device credentials redesign**
   - Redesign credential storage/signing with per-device key versioning, expiry, overlap rotation, and revocation.
   - Evidence: security design doc + passed auth/replay/rotation tests.
2. **Repo hygiene**
   - Remove duplicate nested project and legacy ZIP archive from Git history moving forward.
   - Evidence: repository tree has no duplicate `Grid Flex/` project or `Grid Flex.zip`.
3. **Simulation/live telemetry separation**
   - Enforce source isolation in ingestion, APIs, dashboards, and analytics outputs.
   - Evidence: end-to-end tests proving simulated and measured paths cannot be confused.
4. **Verified inverter integration**
   - Complete one production-grade inverter integration with verified register map and read path.
   - Framework: read-only Modbus FC03 adapter + decoder + vendor map gate (`docs/INVERTER_INTEGRATION.md`).
   - Remaining: fill equipment dossier with the pilot unit’s manufacturer map; HIL worksheet sign-off.
   - Evidence: vendor map approval + live telemetry capture trace.
5. **ESP32 resiliency**
   - Store-and-forward (LittleFS), watchdog, signed remote config, OTA safety — see `docs/EDGE_RELIABILITY.md` and `firmware/GridFlexEdge/`.
   - Remaining: flash pilot hardware, pin Ed25519 public key, 24h outage soak on site.
   - Evidence: firmware serial logs + `backend/tests/edge-reliability.test.ts`.
6. **HIL robustness**
   - Packet matrix + safe bench — `docs/HARDWARE_IN_THE_LOOP.md`.
   - Remaining: execute on-site bench and complete `docs/equipment/hil-evidence-worksheet.md` sign-off.
   - Evidence: signed HIL report with pass/fail per scenario.
7. **Managed secrets and credential rotation**
   - Inventory, manager selection, JWT `kid` overlap, ordered rotation — `docs/MANAGED_SECRETS.md`, `docs/SECRETS_INVENTORY.md`, `docs/runbooks/secret-rotation.md`.
   - Remaining: populate last-rotated dates, execute production rotation, emergency rehearsal log entry.
   - Evidence: rotation log + inventory owners + `npm run check:secrets-hygiene`.
8. **Database restoration**
   - Neon PITR/history window + isolated restore drill — `docs/runbooks/database-backup-restore.md`.
   - Targets: RPO 15m, RTO 2h; quarterly drills.
   - Remaining: execute first restore into isolated branch and complete evidence worksheet.
   - Evidence: `docs/runbooks/backup-restore-evidence.md` + `npm run restore:verify`.
9. **Central observability**
   - Structured JSON logs, Prometheus `/api/metrics`, trace IDs, alert catalog — `docs/OBSERVABILITY.md`.
   - Remaining: wire hosting log drain + live alert routes; complete on-call fire-drill.
   - Evidence: alert-review log + metrics scrape proof.
10. **Environment parity**
    - Matrix + immutable digest promotion + `npm run check:env-parity` / `report:parity` — `docs/ENVIRONMENT_PARITY.md`.
    - Remaining: first signed production promotion evidence.
    - Evidence: `go-live-reports/parity-report-latest.json`.
11. **External penetration test**
    - Written auth/scope/RoE, independent tester, severity SLAs, retest — `docs/PENETRATION_TEST.md`.
    - Remaining: select tester, execute engagement, close critical/high via retest.
    - Evidence: signed report in vault + `docs/pentest/remediation-tracker.md`.
12. **Load/performance validation**
    - Pilot load model (3× margin), k6 scenarios, Socket.IO fan-out, SLOs — `docs/LOAD_TESTING.md`.
    - Remaining: run formal staging soak; fill evidence worksheet + capacity estimates.
    - Evidence: `docs/load/evidence-worksheet.md` + k6 summaries.
13. **Supply-chain security**
    - Add SBOM generation, secret scanning, and container image scanning in CI.
    - Evidence: CI artifacts and policy gates.
14. **POPIA governance**
    - Establish POPIA data-handling procedures and recurring access reviews.
    - Evidence: approved policy docs + access-review cadence.
15. **Physical execution remains disabled**
    - Keep physical execution disabled throughout the initial pilot.
    - Evidence: config lock + startup safety validation logs.
