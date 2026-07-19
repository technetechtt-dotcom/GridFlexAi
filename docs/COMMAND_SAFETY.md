# Command Safety Architecture

GridFlex builds the software structure for safe plant control **without enabling unrestricted physical actuation**.

## Control posture

| Control | Status |
|---|---|
| `PHYSICAL_COMMAND_EXECUTION_ENABLED` | Defaults to `false`; rejected in production configuration |
| Zolt AI | May **propose** commands only — no approve/execute tool |
| Executor | **Simulated** only in PR4 |
| Local safety controller | Validates signed packages; cloud cannot override local hard limits |

## Domain models

- `CommandRequest` — proposed setpoint / advisory action with limits, expiry, risk, source
- `CommandApproval` — human decision with separation-of-duties enforcement
- `CommandExecution` — send / ack / read-back / rollback record (`executorMode: simulated` by default)

### Statuses

`proposed` → `pending_approval` → `approved` | `rejected` → `queued` → `sent` → `acknowledged` → `verified`

Terminal / interrupt paths: `expired`, `failed`, `rolled_back`, `cancelled`

Emergency cancellation and override states (`manual_override`, `emergency_stop`, `safe_state`) are audited.

## Safety checks (cloud advisory path)

1. **Expiry** — reject if `expiresAt` has passed
2. **Range** — `minimumAllowed` / `maximumAllowed`
3. **Ramp** — `maxRampPerMinute` vs `currentValue`
4. **Site / asset state** — plant/asset not maintenance/decommissioned; asset available
5. **Separation of duties** — requester cannot approve when `requireSeparationOfDuties` is true (default), especially for high/critical risk
6. **Audit** — every transition writes an `AuditLog` row

## API (authenticated)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/commands` | List (tenant-scoped) |
| `GET` | `/api/commands/:id` | Detail |
| `POST` | `/api/commands` | Create (`proposed`) |
| `POST` | `/api/commands/:id/submit` | → `pending_approval` |
| `POST` | `/api/commands/:id/approve` | Approve (managers+) |
| `POST` | `/api/commands/:id/reject` | Reject |
| `POST` | `/api/commands/:id/cancel` | Cancel / emergency |
| `POST` | `/api/commands/:id/override` | Set override state |
| `POST` | `/api/commands/:id/execute` | **Simulated** executor only |

## Zolt AI

- Tool: `proposeCommand` — creates `CommandRequest` with `source=zolt_ai`, `advisoryOnly=true`
- No tool may approve or execute plant commands
- System prompt states physical actuation is disabled

## Local safety controller

See `backend/src/safety/local-safety-controller.ts`:

- Receive signed command packages
- Reject expired commands
- Verify site/device identity against signed local limits
- Validate range, ramp, interlocks, communication health
- Optionally send via adapter + read-back + rollback
- Enter defined safe state on loss of communication
- Runs **without** Zolt AI
- Physical adapter path requires `physicalEnabled: true` (never default)

## Hardware-in-the-loop (HIL) readiness

Physical command adapters must stay disabled until all of the following exist:

1. Real vendor register maps (not fictitious examples)
2. Site-specific signed local limits
3. Plant owner written approval
4. HIL test evidence for read-back, ramp, interlock and comms-loss behaviour
5. Explicit change of `PHYSICAL_COMMAND_EXECUTION_ENABLED` after production safety review

## Migration

Apply Prisma migration `20260719180000_command_safety_architecture`.
