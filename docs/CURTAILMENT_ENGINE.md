# Curtailment detection engine (PR 2)

GridFlex AI detects renewable curtailment as first-class events. Powers are stored in **kW** and energies in **kWh**. Physical plant control remains disabled (`PHYSICAL_COMMAND_EXECUTION_ENABLED` stays off).

## Calculation

```
curtailedPowerKw = max(0, availablePowerKw - actualPowerKw)
```

Available power uses ranked evidence:

1. Inverter available-power register
2. PPC available-power value
3. Validated weather / plant-performance model
4. Peer-inverter comparison
5. Historical baseline fallback

Energy loss uses trapezoidal integration over the event window. Events require a configurable persistence window so single noisy samples do not create events. Adjacent same-cause intervals are merged.

Domain modules:

- `backend/src/domain/curtailment/engine.ts`
- `backend/src/domain/forecast/scoring.ts`

## Recoverable energy

`equipment_fault`, `inverter_clipping`, `inverter_derating`, and uncertain weather evidence set `recoverableEnergyKwh = 0`. Grid-related causes (`export_limit`, `ppc_limit`, and similar) keep recoverable energy equal to estimated lost energy unless an operator correction says otherwise.

Operator corrections are stored on `CurtailmentCorrection` and **never overwrite** the original calculated fields.

## Forecast accuracy

`ForecastRun` / `ForecastValue` store immutable vintages with p10/p50/p90, provider, version, source type, quality and freshness. Scoring (`MAE`, `RMSE`, `MAPE`, bias) is persisted per plant and horizon on `ForecastAccuracyScore`. Clear-sky and persistence baselines are stubs labelled **estimated** — cloud-cover-derived irradiance is never presented as measured.

## Grid constraints

`GridConstraint` holds feeder / transformer / line / export / outage / operator / contingency limits with provenance. High PV output alone is not treated as congestion. Where real grid data is missing, UI pages show `SimulationBanner`.

## APIs (tenant-scoped)

- `GET /api/curtailment/events`
- `GET /api/curtailment/summary`
- `GET /api/curtailment/events/:eventId`
- `POST /api/curtailment/detect`
- `PATCH /api/curtailment/events/:eventId/review`
- `POST /api/curtailment/events/:eventId/corrections`
- `GET|POST /api/forecast-accuracy/scores`
- `GET|POST /api/forecast-accuracy/runs`
- `GET|PUT /api/forecast-accuracy/plants/:plantId/config`
- `GET|POST|PATCH|DELETE /api/grid-constraints`

Calculation version: `curtailment-v1`.
