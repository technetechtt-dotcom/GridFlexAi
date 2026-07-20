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
| Image digest | `sha256:…` |
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
- [ ] Env key schemas match (`npm run check:env-parity`)
- [ ] Physical actuation remains disarmed in both envs
- [ ] Go/no-go summary generated (`npm run verify:go-live:summary`) if used

## History

| Date | Commit | Digest (short) | Staging | Prod | Approver |
|------|--------|----------------|---------|------|----------|
| _TBD_ | | | | | |
