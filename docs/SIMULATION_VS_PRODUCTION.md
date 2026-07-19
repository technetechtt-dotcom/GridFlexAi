# Simulation vs Production

GridFlex intentionally mixes measured, forecast, calculated and simulated surfaces. Operators must never treat simulation as plant truth.

## Always simulated / advisory in current product

- HyShift electrolyser digital twin
- Hydrogen production / LCOH / water consumption where no hardware adapter is connected
- Sector coupling allocation
- Scenario simulation and GET topology optimisation
- Dynamic line rating and congestion reduction scenarios without real feeder limits
- Transfer-capacity gain, revenue uplift, curtailment saved, grid stability score and green credits when derived from simulation endpoints
- Synthetic wind/load forecast bands when weather providers are unavailable

## Measured when ingested from authenticated devices

- Edge voltage/current/power readings via `/api/edge-data` or `/api/v2/telemetry/batch`
- Node last-seen / health transitions derived from ingest timestamps

## Forecast

- Forecast.Solar / OpenWeather / AccuWeather outputs are forecasts, never measured irradiance or load.

## Control posture

`PHYSICAL_COMMAND_EXECUTION_ENABLED` defaults to false and is rejected in production configuration. Zolt AI may propose analysis and advisory commands only; it cannot approve or execute plant commands. See [COMMAND_SAFETY.md](./COMMAND_SAFETY.md).
