# GCIP / production assurance status (2026-10-12)

## Completed

| Item | Status | Evidence |
|------|--------|----------|
| Backend tests | **Done** | 232/232 |
| Frozen demo pack | **Done** | `gcip-demo-2026-10-12.1` + `npm run validate:demo-pack` |
| Synthetic site / internal reviewer | **Done** | No Prieska Solar brand |
| Signed image + Blueprint pin | **Done** | Run 38247083265 · digest `sha256:d4921bde…fb0d` · SHA `1f76258` |
| GCIP e2e + responsive | **Done** | critical-path + gcip-responsive |
| Presentation UI pack | **Done** | Techne Tech branding, Start demonstration, 5-step progress, timer, ask slide, QR → `/product-info`, projector chart labels |
| Offline pack verify | **Done** | validate script + `docs/competition/offline-rehearsal.md` |
| Synthetic FAQ | **Done** | `docs/competition/synthetic-dataset-faq.md` |
| Warmup script | **Done** | `npm run warmup:staging` hits frontend + backend |

## Operator / laptop (presentation day)

| Item | Status | Notes |
|------|--------|-------|
| Create/test `gcip.demo@…` account | **Operator** | Invite on staging; see `GCIP-demo-account.md` |
| Walk `/gcip?demo=1` end-to-end | **Operator** | Use Start demonstration → five steps |
| Generate PDF on presentation laptop | **Operator** | Ask slide or Pilot case → Verified PDF → Print |
| Record backup demo video | **Operator** | `offline-demo-recording.md` |
| Warm Render before judges | **Operator** | `npm run warmup:staging` 10–15 min early |
| Confirm live UI shows frozen pack badge | **Operator** | Progress bar shows `gcip-demo-2026-10-12.1` |
| Render digest deploy | **Operator** | `gridflex-backend-prod` image + RELEASE_* env |
| Cosign verify | **Operator** | `IMAGE_DIGEST=sha256:d4921bde… npm run verify:cosign-image` |

## Production identity

```
REQUIRE_RELEASE_IDENTITY=true
RELEASE_GIT_SHA=1f7625888ffd25e2d588c109741217666486c9d8
RELEASE_IMAGE_DIGEST=sha256:d4921bde8c89d599a0af9d49e7be337cac29b414a216db8383f69f202456fb0d
```
