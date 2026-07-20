# Pilot physical-execution lock (Phase 15)

Physical plant actuation stays **disarmed** for the entire initial pilot.

## Config sources (all must show disarmed)

| Source | Keys |
|--------|------|
| Runtime | `PHYSICAL_COMMAND_EXECUTION_ENABLED=false` |
| Runtime | `HIL_PLANT_APPROVAL_CONFIRMED=false` |
| Pilot lock | `PILOT_LOCK_PHYSICAL_EXECUTION=true` (default) |
| Templates | `env-keys/staging.env.keys`, `production.env.keys` |
| Hosting | `render.yaml`, docker-compose |
| CI | backend job env |
| Parity | `npm run check:env-parity` |

Startup logs `event=server.listening` with `physicalExecutionArmed: false` while locked.

Arming requires **all** of:

1. Written HIL + plant approval
2. `PILOT_LOCK_PHYSICAL_EXECUTION=false`
3. Both dual flags `true`
4. Production safety validation pass

## Attestation checklist

| Check | Evidence | Pass? |
|-------|----------|-------|
| Staging env both flags false | Screenshot / env export (redacted) | |
| Production env both flags false | Secret manager | |
| `PILOT_LOCK_PHYSICAL_EXECUTION=true` | Config | |
| Boot log shows `physicalExecutionArmed: false` | Log line | |
| `npm test -- production-safety-env` | CI | |
| `check:env-parity` PASS | Report | |

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Engineering | | | |
| Plant representative | | | |
