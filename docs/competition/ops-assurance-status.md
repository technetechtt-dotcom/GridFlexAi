# GCIP / production assurance status (2026-10-12)

## Completed in this remediation

| Item | Status | Evidence |
|------|--------|----------|
| Fix six failing backend tests | **Done** | `production-safety-env.test.ts` — **232/232** backend tests pass |
| Validate frozen demo dataset | **Done** | `npm run validate:demo-pack` + `docs/competition/evidence/frozen-demo-pack.md` |
| Correct independent reviewer wording | **Done** | Internal GridFlex pilot desk only |
| Remove unproven site brand claims | **Done** | Synthetic “NC Demo Plant”; Prieska/Cookhouse UI claims removed; no third-party brand |
| Confirm Prieska Solar name permission | **Not granted** | Brand unused; synthetic name only |
| Freeze demonstration data | **Done** | `FROZEN_DEMO_PACK_VERSION=gcip-demo-2026-10-12.1` |
| Offline fallback rehearsal | **Done** | Embedded pack + validation script + GCIP offline panel |
| Screenshot / backup harness | **Done** | `npm run capture:gcip-demo` → `docs/competition/evidence/screens/` (6 PNGs) |
| Create signed image from corrected latest commit | **Done** | Run [38247083265](https://github.com/technetechtt-dotcom/GridFlexAi/actions/runs/38247083265) Cosign-signed `sha256:d4921bde…fb0d` for `1f76258` |
| Digest pin in Blueprint | **Done** | `render.yaml` → `gridflex-backend-prod` @ new digest |
| Require release identity (prod service) | **Done** | `REQUIRE_RELEASE_IDENTITY=true` + SHA/digest in Blueprint |
| GCIP + critical-path e2e | **Done** | 13/13 pass (`critical-path` + `gcip-responsive`) |
| End-to-end responsive testing | **Done** | chromium + tablet + mobile GCIP specs |

## Partially done / needs operator secrets or live env

| Item | Status | Notes |
|------|--------|-------|
| Deploy digest image on Render | **Operator** | Manual deploy of `gridflex-backend-prod` with GHCR creds |
| Cosign verify on workstation | **Operator** | `IMAGE_DIGEST=sha256:a2d8c9b8… npm run verify:cosign-image` (needs `cosign` binary) |
| Re-sign after honesty fixes land | **Done** | Run 38247083265; Blueprint re-pinned |
| Full GCIP journey with real demo account | **Operator** | Create `gcip.demo@…` via invite; walk `/gcip?demo=1` |
| PDF on presentation laptop | **Operator** | `/pilot-case` → Verified pilot PDF → Print |
| Signed-ingest load | **Blocked** | Needs device credential + secret (`load/sign-gridflex-v1.mjs`) |
| WebSocket load | **Attempted** | Staging returned 0/5 connects from this host (cold/auth/network); re-run from warmed VPN/CI |
| Access-review export | **Gated** | `EXPORT_ACCESS_REVIEW_ALLOW=true npm run export:access-review` against live DB |
| DB restore drill | **Operator** | Follow `docs/runbooks/database-backup-restore.md` |
| Central logging + real alerts | **Operator** | Set `ALERT_WEBHOOK_*` on digest service; `npm run drill:alert-webhook` |
| External penetration test | **External** | Schedule firm; store report under `docs/security/` |
| POPIA sign-off | **Process** | Checklist below |

## POPIA / access-review checklist

- [ ] `EXPORT_ACCESS_REVIEW_ALLOW=true npm run export:access-review`
- [ ] Inactive / suspended accounts reviewed
- [ ] Admin MFA acknowledgement recorded
- [ ] Invitation expiry / revoke policy confirmed
- [ ] Demo account credentials rotated after GCIP if shared verbally

## Production identity to set on Render (from signed run 38247083265)

```
REQUIRE_RELEASE_IDENTITY=true
RELEASE_GIT_SHA=1f7625888ffd25e2d588c109741217666486c9d8
RELEASE_IMAGE_DIGEST=sha256:d4921bde8c89d599a0af9d49e7be337cac29b414a216db8383f69f202456fb0d
```
