# Simulation vs Production

GridFlex separates **simulation** from **live measured** telemetry at the data model, API, Socket.IO namespace, and UI layers.

## Operating mode (backend-owned)

`GRIDFLEX_OPERATING_MODE`:

| Mode | Meaning | Default stream environment |
|------|---------|----------------------------|
| `SIMULATION` | Backend publisher writes synthetic readings | `simulation` |
| `HIL` | Hardware-in-the-loop | `hil` |
| `PILOT_LIVE` | Measured pilot advisory | `live` |
| `PRODUCTION_ADVISORY` | Measured production advisory | `live` |

The browser cannot override this. `GET /api/operating-mode` drives the persistent banner and watermark.

## Streams

| Concern | Path / namespace |
|---------|----------------|
| Live measured ingest | `/api/v2/telemetry`, `/api/edge-data` → Socket.IO default (`live-reading`) |
| Simulation | `/api/simulation/telemetry` → Socket.IO `/simulation` (`simulation-reading`) |

Client-side `Math.random()` telemetry generation in `RealTimeContext` is **removed**. When offline, the UI holds last values and marks them stale.

## Database separation

`SensorReading` and `TelemetryReading` include:

- `sourceType` (`measured` | `simulated` | …)
- `environment` (`live` | `simulation` | `hil`)
- `simulationRunId` (optional)

Live KPI / dashboard / readings-summary queries **exclude** `environment=simulation` and `sourceType=simulated` unless the operating mode is `SIMULATION` (or the caller explicitly opts in).

## Provenance on every number

Display contract (`Provenance`):

- `sourceType`, `sourceId`, `quality` (`good` | `uncertain` | `bad` | `stale`)
- `measuredAt`, `receivedAt`, `unit`, optional `calibrationVersion`

## Control posture

`PHYSICAL_COMMAND_EXECUTION_ENABLED` defaults to false. Zolt may propose advisory commands only. See [COMMAND_SAFETY.md](./COMMAND_SAFETY.md).
