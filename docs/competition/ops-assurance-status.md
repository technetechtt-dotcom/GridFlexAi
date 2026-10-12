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
| Create signed image from known commit | **Done** | Run [38242990580](https://github.com/technetechtt-dotcom/GridFlexAi/actions/runs/38242990580) Cosign-signed `sha256:a2d8c9b8…7c09` for `35400d7` |
| Digest pin in Blueprint | **Done** | `render.yaml` → `gridflex-backend-prod` |
| Require release identity (prod service) | **Done** | `REQUIRE_RELEASE_IDENTITY=true` + SHA/digest in Blueprint |
| GCIP + critical-path e2e | **Done** | 13/13 pass (`critical-path` + `gcip-responsive`) |
| End-to-end responsive testing | **Done** | chromium + tablet + mobile GCIP specs |

## Partially done / needs operator secrets or live env

| Item | Status | Notes |
|------|--------|-------|
| Deploy digest image on Render | **Operator** | Manual deploy of `gridflex-backend-prod` with GHCR creds |
| Cosign verify on workstation | **Operator** | `IMAGE_DIGEST=sha256:a2d8c9b8… npm run verify:cosign-image` (needs `cosign` binary) |
| Re-sign after honesty fixes land | **Follow-up** | After this push, re-run **Release Backend Image** and re-pin digest |
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

## Production identity to set on Render (from signed run 38242990580)

```
REQUIRE_RELEASE_IDENTITY=true
RELEASE_GIT_SHA=35400d704251b5e3577c26a33f7b0ed79ceb09df
RELEASE_IMAGE_DIGEST=sha256:a2d8c9b833dedab8ed5b7d7f45dd7288502aa93daf6d22d890c5edab549d7c09
```

Re-pin both values after the next Release Backend Image run for the honesty/test commit.
