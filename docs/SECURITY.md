# Security

GridFlex is an **advisory operations platform**. It does **not** replace protection relays, PPC safety interlocks, or BMS protection.

Physical command execution remains disabled (PHYSICAL_COMMAND_EXECUTION_ENABLED=false) until plant approval and hardware-in-the-loop validation.

Browser refresh tokens are cookie-only (`HttpOnly`, `Secure` in production,
`SameSite=Lax`) and are never returned in JSON or stored in `localStorage`.
Render proxies `/api/*` through the frontend origin so the cookie remains
same-site.

## Tenancy and access
- Alarm/incident/Zolt paths use 
esolveAccessScope.
- Organisation and site memberships bound scope.

## Secrets and AI (Zolt)
- Prompts are secret-redacted; tool use is logged.
- Zolt may propose commands only — there is no execute tool.
- Tool responses include provenance (source, sOf, reshnessSeconds).

## Ops hardening
- Redis Socket.IO adapter when REDIS_URL is set.
- Telemetry retention purge is opt-in via TELEMETRY_RETENTION_* and uses purgeExpiredTelemetry.
