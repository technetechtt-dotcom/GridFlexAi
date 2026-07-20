# Pilot deployment

Stay in observe + advise mode.

## Hard safety controls

1. `PHYSICAL_COMMAND_EXECUTION_ENABLED=false` in all pilot environments.
2. GridFlex does **not** replace protection relays, PPC safety, or BMS protection.
3. `REDIS_URL` configured for Socket.IO adapter and edge replay protection.
4. Keep retention purge off until policy sign-off.
5. Deploy migration `20260719210000_pr5_alarms_incidents`.

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
   - Evidence: vendor map approval + live telemetry capture trace.
5. **ESP32 resiliency**
   - Finish store-and-forward queues, watchdog behavior, and remote config lifecycle.
   - Evidence: firmware and integration test reports.
6. **HIL robustness**
   - Execute HIL tests for malformed, delayed, duplicated, stale, and out-of-range packets.
   - Evidence: signed HIL report with pass/fail per scenario.
7. **Managed secrets and credential rotation**
   - Move all secrets to managed secret store; rotate current API/device/admin credentials.
   - Evidence: rotation log and post-rotation validation run.
8. **Database restoration**
   - Perform and document restoration drill from production-like backup.
   - Evidence: RTO/RPO measurements and restored data integrity checks.
9. **Central observability**
   - Enable centralized logs, metrics, alerting, and notification routing.
   - Evidence: alert fire-drill outputs and on-call routing proof.
10. **Environment parity**
    - Prove staging and production parity for configs, migrations, and critical dependencies.
    - Evidence: parity report and diff-free baseline.
11. **External penetration test**
    - Complete third-party security assessment and remediate critical/high findings.
    - Evidence: final report and remediation closure tracker.
12. **Load/performance validation**
    - Run ingest, WebSocket fan-out, and data-volume load tests.
    - Evidence: throughput/latency/error budget report.
13. **Supply-chain security**
    - Add SBOM generation, secret scanning, and container image scanning in CI.
    - Evidence: CI artifacts and policy gates.
14. **POPIA governance**
    - Establish POPIA data-handling procedures and recurring access reviews.
    - Evidence: approved policy docs + access-review cadence.
15. **Physical execution remains disabled**
    - Keep physical execution disabled throughout the initial pilot.
    - Evidence: config lock + startup safety validation logs.
