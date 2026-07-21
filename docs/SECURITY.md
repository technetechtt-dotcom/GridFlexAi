# Security

GridFlex is an **advisory operations platform**. It does **not** replace protection relays, PPC safety interlocks, or BMS protection.

Physical command execution remains disabled (PHYSICAL_COMMAND_EXECUTION_ENABLED=false) until plant approval and hardware-in-the-loop validation.

Browser refresh tokens are cookie-only (`HttpOnly`, `Secure` in production,
`SameSite=Lax`) and are never returned in JSON or stored in `localStorage`.
Short-lived access tokens are held in browser memory only; legacy browser token
keys are removed during startup and logout.
Render proxies `/api/*` through the frontend origin so the cookie remains
same-site.

## Tenancy and access
- Alarm/incident/Zolt paths use `resolveAccessScope`.
- Organisation and site memberships bound scope.
- Live and simulation WebSocket namespaces require JWT authentication, enforce
  tenant rooms, and terminate sessions when the access token expires.

## Secrets and AI (Zolt)
- Prompts are secret-redacted; tool use is logged.
- Zolt may propose commands only — there is no execute tool.
- Tool responses include provenance (`source`, `asOf`, `freshnessSeconds`).

## Ops hardening
- Redis Socket.IO adapter when REDIS_URL is set.
- Telemetry retention purge is opt-in via TELEMETRY_RETENTION_* and uses purgeExpiredTelemetry.
