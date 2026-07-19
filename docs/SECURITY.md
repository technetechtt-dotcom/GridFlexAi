# Security

GridFlex is an advisory operations platform. It does not replace protection relays, PPC safety interlocks, or BMS protection.

- PHYSICAL_COMMAND_EXECUTION_ENABLED must remain false
- Zolt proposeCommand is proposal-only
- Tenancy enforced on alarms/telemetry/AI tools
- Redis Socket.IO adapter when REDIS_URL is set
- Telemetry retention purge is opt-in
