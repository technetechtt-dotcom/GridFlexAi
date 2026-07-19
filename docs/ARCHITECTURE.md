# Architecture — PR 1 Foundation

GridFlex AI is evolving from a prototype into a multi-tenant, read-only plant intelligence and advisory platform.

## Current runtime shape

- React + Vite frontend (`src/`)
- Express + Prisma + PostgreSQL backend (`backend/`)
- Socket.IO for live reading/status events
- Optional Redis for forecast cache and edge replay protection
- OpenAI Zolt AI, Forecast.Solar, OpenWeather, AccuWeather

## PR 1 additions

1. **Data provenance & units** — shared enums for source/quality/unit; conversion utilities; SensorReading provenance fields; UI simulation banners and provenance badges.
2. **Multi-tenancy foundation** — `Organisation`, `OrganisationMembership`, `SiteMembership`; Client rows preserved and linked; permission middleware with cross-tenant denial tests.
3. **Plant/asset domain** — `Plant`, `Asset`, constraints/state; EdgeNode optional `assetId` link; demo plant seeded as `simulated`.
4. **Telemetry v2** — `TelemetryPointDefinition` + `TelemetryReading`; `POST /api/v2/telemetry/batch`; legacy `POST /api/edge-data` retained.
5. **Device credentials** — per-device credential provisioning/rotation/revocation; legacy shared secret mode behind `EDGE_ALLOW_LEGACY_SHARED_SECRET` (must be false in production).
6. **Redis replay protection** — shared nonce store with fail-closed options for production.
7. **Node health** — health states, thresholds, history, background evaluator.
8. **Credential hardening** — production seed passwords not printed; physical command execution flag forced off in production.

## Explicit non-goals (still deferred)

- Curtailment detection engine (PR 2)
- Advisory optimisation (PR 3)
- Unrestricted physical plant actuation (gated forever until HIL + plant approval)
- Real vendor Modbus/OPC register maps (supply via configuration; fictitious examples only)

## PR 4 additions

See [COMMAND_SAFETY.md](./COMMAND_SAFETY.md) and [INDUSTRIAL_GATEWAY.md](./INDUSTRIAL_GATEWAY.md).

## Compatibility

- Existing ESP32 HMAC ingest remains supported in legacy mode.
- Breaking for production: legacy shared secret must be disabled; devices should migrate to per-device credentials.
