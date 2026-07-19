# Industrial Gateway Foundation

Vendor-neutral adapter interfaces live under `backend/src/gateway`.

## Protocols

| Protocol | Status in PR4 |
|---|---|
| Modbus RTU | Simulated adapter + register-map schema |
| Modbus TCP | Simulated adapter + fictitious example map |
| SunSpec Modbus | Simulated adapter interface |
| OPC UA | Simulated adapter interface |
| MQTT | Simulated adapter + fictitious BESS example map |
| REST | Simulated adapter interface |
| IEC 61850 | Placeholder only |
| IEC 60870-5-104 | Placeholder only |
| DNP3 | Placeholder only |

## Non-negotiables

- **Do not invent real vendor register addresses.**
- Example maps must set `fictitious: true` and carry an explicit label such as `FICTITIOUS EXAMPLE`.
- Gateway defaults: `readOnly: true`, `physicalCommandExecutionEnabled: false`.
- Writes throw unless both read-only is off **and** the physical flag is explicitly enabled (post-HIL only).

## Register maps

- Schema validation: `parseRegisterMap()` in `register-map.ts`
- Fictitious examples: `gateway/maps/fictitious-examples.ts`
- Points reference opaque `address` strings supplied by configuration — never hard-coded as “real” plant addresses in application logic

### Onboarding a real vendor map

1. Obtain the vendor Modbus/SunSpec/OPC dictionary under NDA.
2. Create a new JSON/TS map with `fictitious: false`, real vendor/model, and verified addresses.
3. Peer-review against the vendor PDF / ICD; never copy from fictitious examples.
4. Bind the map to a site/asset in configuration (future work).
5. Run HIL with the local safety controller before enabling writes.
6. Document the map version, checksum and approval ticket in plant change control.

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
