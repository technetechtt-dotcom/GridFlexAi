# Security

GridFlex treats plant safety and tenant isolation as first-class requirements.

## Zolt AI safety

- Zolt must call a tool on the first reasoning step.
- Chat context is redacted for bearer tokens and secret-like strings.
- `proposeCommand` returns advisory proposals only.
- `PHYSICAL_COMMAND_EXECUTION_ENABLED` defaults to `false`.

## Operations

- Readiness exposes database connectivity and the physical command execution flag.
- Socket.IO can use a Redis adapter when `REDIS_URL` is configured.
