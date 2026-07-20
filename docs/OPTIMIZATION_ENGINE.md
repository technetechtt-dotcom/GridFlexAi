# Optimisation Engine ΓÇö Advisory Mode (PR 3)

GridFlex AI includes an **advisory-only** mathematical optimisation engine for flexible assets (BESS and electrolysers). It proposes schedules and expected economic benefit. It does **not** send plant commands.

## Safety posture

- `PHYSICAL_COMMAND_EXECUTION_ENABLED` remains `false` and is rejected in production configuration.
- Every `OptimizationRun` is stored with `advisory: true`.
- Every `DispatchSchedule` row defaults to status `advisory`.
- Solver assumptions always include `physicalControl: false`.
- Hardware adapter interfaces exist as contracts only. No vendor Modbus/SunSpec register maps are invented in this repository.

## Architecture

```
API ΓöÇΓöÇΓû║ optimisation.service ΓöÇΓöÇΓû║ AdvisoryOptimisationEngine
                                      Γöé
                                      Γû╝
                           DeterministicAdvisorySolver (TypeScript)
                                      Γöé
                                      Γû╝
                     OptimizationRun + DispatchSchedule (Postgres)
```

Domain modules:

| Path | Role |
|------|------|
| `backend/src/domain/flexible-assets/` | Provenance-aware BESS/electrolyser config & state, constraint validation, simulated adapters |
| `backend/src/domain/optimisation/` | Solver abstraction + deterministic advisory solver |
| `backend/src/services/optimisation.service.ts` | Persistence, tenancy checks, API orchestration |

## Provenance rules

Flexible-asset values are wrapped as provenanced numbers:

- **configured / operator_entered / imported** ΓÇö plant or operator parameters
- **measured** ΓÇö only when a future authenticated hardware adapter supplies them
- **simulated / estimated / forecast** ΓÇö must be labelled; never presented as measured BMS/stack telemetry

Seeded demo BESS and electrolyser assets use `simulationMode: true` and `socSource` / `loadSource: simulated`.

## Objectives and constraints

The deterministic solver maximises a weighted net benefit of:

- grid export revenue
- hydrogen revenue
- avoided curtailment value (via reduced remaining curtailment cost)

and minimises:

- battery degradation cost
- electrolyser operating cost
- remaining curtailment

Hard / soft constraints enforced in validation or physics truncation:

- export limit, generation forecast, demand
- BESS SOC min/max/reserve, charge/discharge limits, efficiency, ramp
- electrolyser min/max load, ramp, storage capacity, maintenance window

Infeasible input configurations return `status: infeasible` with explicit `constraintViolations`. Constraints are never silently ignored.

## Solver version

Current solver id: `gridflex-advisory-deterministic-v1`

It is a deterministic surplus-absorption heuristic (charge BESS then electrolyser before curtailing; discharge when short). It is intentionally **not** a commercial MIP/LP package. The `Solver` interface allows swapping implementations later without changing the API contract.

## Baseline and sensitivity

Each completed run stores:

- optimised objective vs no-action baseline (`baselineComparison`)
- `expectedBenefitZar`
- sensitivity band under forecast uncertainty (`sensitivity`)

## APIs

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/api/assets/:assetId/bess-model` | Config + state + violations |
| `PUT` | `/api/assets/:assetId/bess-configuration` | Validated upsert |
| `GET` | `/api/assets/:assetId/electrolyser-model` | Config + state + violations |
| `PUT` | `/api/assets/:assetId/electrolyser-configuration` | Validated upsert |
| `POST` | `/api/optimisation/runs` | Create advisory run + schedules |
| `GET` | `/api/optimisation/runs` | List (tenant scoped) |
| `GET` | `/api/optimisation/runs/:runId` | Detail + schedules |

All responses that carry schedules include advisory labelling in service payloads.

## UI

The Dispatch Optimisation page shows a persistent simulation/advisory banner, removes auto-dispatch ΓÇ£enabledΓÇ¥ control language, and labels recommendations as advisory.

## Tests

See `backend/tests/advisory-optimisation.test.ts` for constraint validation and deterministic fixture coverage.
