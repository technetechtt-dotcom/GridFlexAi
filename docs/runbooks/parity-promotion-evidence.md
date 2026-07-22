# Parity promotion evidence (Gate 10)

One section per promote-to-production. **Never** paste secret values.

## Promotion record

| Field | Value |
|-------|-------|
| Date (UTC) | |
| Operator | |
| Git commit SHA | |
| CI run URL | |
| Image tag | `gridflex-backend:<sha>` |
| Registry image digest | `sha256:<64 lowercase hex>` (tags and local image IDs are invalid) |
| Staging deploy time (UTC) | |
| Staging smoke (`verify:go-live:staging`) | pass / fail |
| Production deploy time (UTC) | |
| Production smoke (`verify:go-live:production`) | pass / fail |
| `check:env-parity` | PASS / FAIL |
| Parity report path | `go-live-reports/parity-report-latest.json` |
| Parity report checksum | `.sha256` / `.sig` |
| Approved config diffs (if any) | |
| Rollback digest (previous prod) | |
| Approver | |
| Pass? | |

## Checklist

- [ ] Production runs the **same** digest that passed staging (no rebuild)
- [ ] Staging and production smoke outcomes are explicitly `pass` or `fail` (never `pending`)
- [ ] Env key schemas match (`npm run check:env-parity`)
- [ ] Physical actuation remains disarmed in both envs
- [ ] Go/no-go summary generated (`npm run verify:go-live:summary`) if used

## History

| Date | Commit | Digest (short) | Staging | Prod | Approver |
|------|--------|----------------|---------|------|----------|
| 2026-07-22 | `7fd0ba3` | `1a0f0aa1…4928` (signed, GHCR) | Open | Open | _pending_ |

## Repository key-schema check — 2026-07-21

`npm run check:env-parity` passed with 67 staging keys and 67 production
keys. Both templates produced schema hash
`23c5f89d19dbfa4b55eed7b7f5e71fe5cad30cd085d144b8bf2fd402db965a2d`.

This closes only the environment-variable **name** comparison. Migration
versions, immutable staging/production image digest, safety/feature flags,
smoke tests and approved runtime differences remain open.
