# Architecture — GridFlex Production Platform

GridFlex AI is a multi-tenant, read-only plant intelligence and advisory optimisation platform.

## Current runtime shape

- React + Vite frontend (`src/`)
- Express + Prisma + PostgreSQL backend (`backend/`)
- Socket.IO for live reading/status events (tenant-scoped rooms)
- Optional Redis for forecast cache, edge replay protection, and Socket.IO scaling
- OpenAI Zolt AI, Forecast.Solar, OpenWeather, AccuWeather

## Foundation (PR 1)

1. **Data provenance & units** — shared enums for source/quality/unit; conversion utilities; UI simulation banners and provenance badges.
2. **Multi-tenancy** — `Organisation`, `OrganisationMembership`, `SiteMembership`; Client rows preserved and linked; permission middleware with cross-tenant denial tests.
3. **Plant/asset domain** — `Plant`, `Asset`, constraints/state; EdgeNode optional `assetId` link; demo plant seeded as `simulated`.
4. **Telemetry v2** — `TelemetryPointDefinition` + `TelemetryReading`; `POST /api/v2/telemetry/batch`; legacy `POST /api/edge-data` retained.
5. **Device credentials** — per-device credential provisioning/rotation/revocation; legacy shared secret mode behind `EDGE_ALLOW_LEGACY_SHARED_SECRET` (must be false in production).
6. **Redis replay protection** — shared nonce store with fail-closed options for production.
7. **Node health** — health states, thresholds, history, background evaluator.
8. **Credential hardening** — production seed passwords not printed; physical command execution flag forced off in production.

## Curtailment & forecast (PR 2)

1. **Curtailment detection engine** — ranked available-power evidence, persistence/merge, trapezoidal energy (kWh), recoverable energy excludes equipment faults; event review + corrections without overwriting originals.
2. **Forecast accuracy** — `PlantForecastConfig`, immutable `ForecastRun`/`ForecastValue` (p10/p50/p90), `ForecastAccuracyScore` (MAE/RMSE/MAPE/bias); clear-sky/persistence baselines labelled estimated.
3. **Grid constraints** — explicit feeder/transformer/line/export/outage/operator/contingency inputs with provenance; congestion UI uses `SimulationBanner` when no real grid data.
4. See `docs/CURTAILMENT_ENGINE.md`.

## Advisory optimisation (PR 3)

- Provenance-aware `BessModelConfig` / `ElectrolyserModelConfig` plus operating-state tables (configured ≠ measured)
- Deterministic TypeScript advisory optimiser (`gridflex-advisory-deterministic-v1`)
- Reproducible `OptimizationRun` + advisory `DispatchSchedule` with baseline comparison and sensitivity
- See `docs/OPTIMIZATION_ENGINE.md`

## Command safety & gateway (PR 4)

- Command request/approval/execution state machine (simulated executor only; physical actuation disabled by default)
- Industrial gateway adapters with fictitious register maps labelled as examples
- Local safety-controller interface and test harness
- See `docs/COMMAND_SAFETY.md` and `docs/INDUSTRIAL_GATEWAY.md`

## Alarms, Zolt hardening & ops (PR 5)

- Alarm rules/events, incidents, acknowledgement workflow, admin alarms dashboard
- Zolt tool scoping, secret redaction, evidence requirements, proposal-only commands
- Redis Socket.IO adapter, telemetry retention cron, security and pilot deployment docs
- See `docs/ALARMS.md`, `docs/SECURITY.md`, `docs/PILOT_DEPLOYMENT.md`

## Explicit non-goals

- Physical plant command execution remains disabled until hardware-in-the-loop validation and real vendor register maps are supplied
- Invented Modbus register maps are never presented as production-ready
- GridFlex does not replace protection relays, PPC safety functions, or BMS protection

## Compatibility

- Existing ESP32 HMAC ingest remains supported in legacy mode.
- Breaking for production: legacy shared secret must be disabled; devices should migrate to per-device credentials.
