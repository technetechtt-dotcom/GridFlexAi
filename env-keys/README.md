# Environment Key Files

These files are for **key parity checks only**:

- `staging.env.keys`
- `production.env.keys`

Do not place secret values in these files.

## Usage

1. Regenerate key templates from backend schema:
   - `npm run env:templates`
2. Copy platform key names into each file (keys only).
3. Run parity:
   - `npm run check:env-parity`

## Safety lock

Set `PHYSICAL_COMMAND_EXECUTION_ENABLED=false` and `HIL_PLANT_APPROVAL_CONFIRMED=false` in staging and production. Physical actuation requires both flags true in production.
