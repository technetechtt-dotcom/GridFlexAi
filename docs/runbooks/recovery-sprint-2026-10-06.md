# Recovery sprint 2026-10-06

## Calculation fixes
- `lostEnergyKwh` now counts **material** intervals only (`gap ≥ max(10 kW, 5% expected)`).
- `affectedDurationHours = affectedIntervals × intervalHours`.
- Opportunity capacity windows use **affected duration**, not the full sample window.
- Each interval returns cause, material flag, lost kWh and opportunity slices.

## Persistence
Migration: `backend/prisma/migrations/20261006140000_recovery_analysis_persistence`.

Entities:
- `RecoveryAnalysisRun`
- `RecoveryEvidence`
- `RecoveryOpportunityRow`
- `RecoveryReview`

## API additions
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/recovery/analyse` | Analyse samples; optional `persist` |
| POST | `/api/recovery/analyse-plant` | Assemble forecast+telemetry then analyse |
| GET | `/api/recovery/analyses` | List persisted analyses |
| GET | `/api/recovery/analyses/:id` | Fetch one analysis |
| PATCH | `/api/recovery/analyses/:id/review` | Operator status / corrected cause |
| GET | `/api/recovery/analyses/:id/report` | HTML or CSV report (`?format=csv`) |

## Staging deploy (item 12)
After the release workflow publishes a signed image:

1. Pin Render backend to `ghcr.io/technetechtt-dotcom/gridflex-backend@sha256:<digest>`.
2. Set `RELEASE_GIT_SHA` and `RELEASE_IMAGE_DIGEST` (+ `EXPECTED_*` when available).
3. Verify:
   ```bash
   EXPECTED_IMAGE_DIGEST=sha256:<digest> \
   EXPECTED_GIT_SHA=<sha> \
   STAGING_BASE_URL=https://gridflex-backend.onrender.com \
   npm run verify:staging-digest
   ```

This workstation cannot complete the Render pin without a Render API token / dashboard action.
