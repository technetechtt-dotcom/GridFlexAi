# Parity promotion evidence (Gate 10)

One section per promote-to-production. **Never** paste secret values.

## Promotion record — RC-2026-07-23 (in progress)

| Field | Value |
|-------|-------|
| Date (UTC) | _pending — fill when staging→prod promote executes_ |
| Operator | _pending_ |
| Git commit SHA | `cdcd3e7ae2b5962ba58f990f3249728b164ab560` |
| CI run URL | https://github.com/technetechtt-dotcom/GridFlexAi/actions/runs/29988892052 |
| Image tag | `gridflex-backend:rc-2026-07-23` / `sha-cdcd3e7…` |
| Registry image digest | `sha256:accf07fc8326ffa15dd4df647af3175bb36b2d9b587270234247324c7e57c718` |
| Staging deploy time (UTC) | **Open** — not yet pinned on Render staging |
| Staging smoke (`verify:go-live:staging`) | **Open** |
| Production deploy time (UTC) | **Open** — blocked on same-digest staging pass |
| Production smoke (`verify:go-live:production`) | **Open** |
| `check:env-parity` | **PASS** (2026-08-03 evening) — 70/70 keys; schema `4814043a7783dab3ddf17c3bf1f968898904d35e3f9108c3913bde85ecf2e094` (adds `RELEASE_GIT_SHA`, `RELEASE_IMAGE_DIGEST`) |
| Parity report path | `go-live-reports/env-parity.json` |
| Parity report checksum | regenerate `.sha256` at promote time |
| Approved config diffs (if any) | `GRIDFLEX_OPERATING_MODE` staging `SIMULATION\|HIL` vs production `PILOT_LIVE\|PRODUCTION_ADVISORY` |
| Rollback digest (previous prod) | _record at promote_ |
| Approver | _pending_ |
| Pass? | **No** — staging/prod digests not yet deployed |

## Checklist

- [ ] Production runs the **same** digest that passed staging (no rebuild)
- [ ] Staging and production smoke outcomes are explicitly `pass` or `fail` (never `pending`)
- [x] Env key schemas match (`npm run check:env-parity`) — PASS 2026-08-03 after PR #87
- [x] Physical actuation remains disarmed in both envs (code/blueprint defaults)
- [ ] Go/no-go summary generated (`npm run verify:go-live:summary`) if used

## History

| Date | Commit | Digest (short) | Staging | Prod | Approver |
|------|--------|----------------|---------|------|----------|
| 2026-07-23 | `cdcd3e7` | `accf07fc…c718` (signed RC-2026-07-23) | Open | Open | _pending_ |
| 2026-07-22 | `7fd0ba3` | `1a0f0aa1…4928` (signed, superseded for pilot) | Open | Open | _pending_ |

## Repository key-schema check — 2026-08-03 (evening)

`npm run check:env-parity` passed with 70 staging keys and 70 production
keys. Schema hash
`4814043a7783dab3ddf17c3bf1f968898904d35e3f9108c3913bde85ecf2e094`.

Adds optional `RELEASE_GIT_SHA` / `RELEASE_IMAGE_DIGEST` for health-advertised
deploy identity (see `staging-rc-digest-deploy.md`).

## Live host probe — 2026-08-03

`https://gridflex-backend.onrender.com` — `/api/health` → database **up**, redis **up**.
No `release` field yet (pre-deploy of health identity). Source Blueprint rebuild — **not**
confirmed as RC digest `accf07fc…c718`.

