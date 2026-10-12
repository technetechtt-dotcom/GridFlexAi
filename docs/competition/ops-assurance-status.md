# GCIP / production assurance status (2026-10-12)

## Completed in product

| Item | Status | Evidence |
|------|--------|----------|
| Exact funding ask | **Done** | **R 1,950,000** · `src/lib/fundingAsk.ts` |
| Use-of-funds breakdown | **Done** | Ask slide + printable pilot request |
| 90-day pilot deliverables | **Done** | Listed on `/gcip/ask` |
| Local QR asset | **Done** | `public/product-info-qr.svg` (+ PNG) — no external QR API |
| Measured (pack) clarity | **Done** | Labels, FAQ, pilot case banner, limitations |
| Frontend release identity | **Done** | `VITE_RELEASE_GIT_SHA` via Render buildCommand; badge on demo progress; Environment page |
| One-page pilot request print | **Done** | Ask slide → Print pilot request |
| Frozen pack / e2e / Techne branding | **Done** | Prior main commits |
| Outdated readiness doc | **Reconciled** | `GCIP-readiness-status.md` → points here |

## Presentation laptop (operator)

| Item | Status |
|------|--------|
| Create & test real demo account | Operator — `GCIP-demo-account.md` |
| Test PDF / report on laptop | Operator |
| Run 7-minute talk ×3 | Operator |
| Record backup video | Operator — `offline-demo-recording.md` |
| Test without internet | Operator — `offline-rehearsal.md` |
| Print pilot request handouts | Operator |
| Warm Render before talk | `npm run warmup:staging` |
| Confirm product-info on phone | Open `https://gridflex-frontend.onrender.com/product-info` or scan QR |

## Production identity (backend)

```
REQUIRE_RELEASE_IDENTITY=true
RELEASE_GIT_SHA=1f7625888ffd25e2d588c109741217666486c9d8
RELEASE_IMAGE_DIGEST=sha256:d4921bde8c89d599a0af9d49e7be337cac29b414a216db8383f69f202456fb0d
```

Frontend builds inject `VITE_RELEASE_GIT_SHA=${RENDER_GIT_COMMIT}` on Render.
