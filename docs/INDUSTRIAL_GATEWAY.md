# Industrial Gateway Foundation

Vendor-neutral adapter interfaces live under `backend/src/gateway`.

## Protocols

| Protocol | Status |
|---|---|
| Modbus RTU | Simulated adapter + register-map schema; verified RTU wiring pending site dossier |
| Modbus TCP | Simulated adapter + **verified read-only FC03 adapter** (`verified-inverter/`) |
| SunSpec Modbus | Simulated adapter interface |
| OPC UA | Simulated adapter interface |
| MQTT | Simulated adapter + fictitious BESS example map |
| REST | Simulated adapter interface |
| IEC 61850 | Placeholder only |
| IEC 60870-5-104 | Placeholder only |
| DNP3 | Placeholder only |

## Verified inverter (pilot)

See [INVERTER_INTEGRATION.md](./INVERTER_INTEGRATION.md). Official vendor maps live under `gateway/maps/vendor/<manufacturer>/<model>/<firmware>.ts`. Until onboarded, `resolvePilotVerifiedInverterMap()` fails closed.

## Non-negotiables

- **Do not invent real vendor register addresses.**
- Example maps must set `fictitious: true` and carry an explicit label such as `FICTITIOUS EXAMPLE`.
- Gateway defaults: `readOnly: true`, `physicalCommandExecutionEnabled: false`.
- Writes throw unless both read-only is off **and** the physical flag is explicitly enabled (post-HIL only).
- In the initial production/pilot build, fictitious “setpoint” points are also **read-only** (no `write`/`read_write`) to prevent any accidental setpoint-writing credentials usage.
- The verified pilot inverter adapter implements **no Modbus write function codes**.

## Register maps

- Schema validation: `parseRegisterMap()` in `register-map.ts`
- Fictitious examples: `gateway/maps/fictitious-examples.ts`
- Verified maps: `gateway/maps/vendor/` + `parseVerifiedInverterMap()`
- Points for verified maps use numeric addresses + word order + scale from the official PDF

### Onboarding a real vendor map

1. Obtain the vendor Modbus/SunSpec/OPC dictionary under NDA / installer package.
2. Complete the equipment dossier and copy `_TEMPLATE_/firmware-version.template.ts`.
3. Peer-review against the vendor PDF; never copy from fictitious examples.
4. Wire `resolve-pilot-map.ts` and run HIL validation worksheet.
5. Keep physical command flags false until HIL + plant approval.

## Runtime features (foundation)

- Timeouts / retries via `GatewayConnectionConfig`
- Circuit breaker (`SimpleCircuitBreaker`)
- Data-quality mapping helper (`mapQualityFromFreshness`)
- Store-and-forward queue interface + in-memory implementation (`InMemoryDurableQueue`)
  - Durable SQLite queue can replace the in-memory implementation at the edge without changing adapter contracts
- Polling interval field on connection config (scheduler wiring is site-specific)

## Simulated equipment

`SimulatedProtocolAdapter` accepts **fictitious** maps only and never opens sockets. Use it for:

- Inverter / PPC / BESS / electrolyser unit tests
- Command safety dry-runs
- CI without OT hardware

## Related

- Command approval / simulated executor: [COMMAND_SAFETY.md](./COMMAND_SAFETY.md)
- Simulation labelling: [SIMULATION_VS_PRODUCTION.md](./SIMULATION_VS_PRODUCTION.md)
