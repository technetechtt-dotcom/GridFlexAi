# Staging RC digest deploy (Gate: signed image on Render)

**Goal:** Run the frozen RC signed image on staging — not a Render source rebuild.

RC-2026-08-12 identity:

| Field | Value |
|-------|-------|
| Commit | `d0cfd3f36b54478767e862280ca8cd38e2bb35df` |
| Image | `ghcr.io/technetechtt-dotcom/gridflex-backend@sha256:644f623f033c6fdbaacf53c1bc4693bc0650f4fd43b096c24420a3fb8433378c` |

## Why `render.yaml` alone is insufficient

The Blueprint backend service uses `env: node` + `buildCommand`. That **rebuilds from
git** and does **not** pin the Cosign-signed GHCR digest. Source deploys cannot close
the staging→prod same-digest promotion gate.

## Operator steps (Render UI)

1. Create or convert a **Docker** web service (staging) that pulls from GHCR:
   - Image URL: `ghcr.io/technetechtt-dotcom/gridflex-backend`
   - Tag / digest: pin **`@sha256:644f623f033c6fdbaacf53c1bc4693bc0650f4fd43b096c24420a3fb8433378c`**
   - Registry credential: GHCR read token (classic PAT with `read:packages`, or org deploy token)
2. Copy env from the existing Node service (or Blueprint), including:
   - `DEVICE_SECRET_VAULT_PROVIDER=aws_kms` + `AWS_KMS_KEY_ID` / region / IAM keys (**#45**)
   - `ALERT_WEBHOOK_ENABLED=true` + `ALERT_WEBHOOK_URL` / `ALERT_WEBHOOK_TOKEN`
   - `METRICS_SCRAPE_TOKEN`
   - Physical lock flags remain **false** / pilot lock **true**
3. Set release identity (exposed on `/api/health`):
   - `RELEASE_GIT_SHA=d0cfd3f36b54478767e862280ca8cd38e2bb35df`
   - `RELEASE_IMAGE_DIGEST=sha256:644f623f033c6fdbaacf53c1bc4693bc0650f4fd43b096c24420a3fb8433378c`
4. Deploy → wait for healthy.
5. Verify:
   ```bash
   curl -s https://<staging-backend>/api/health
   EXPECTED_IMAGE_DIGEST=sha256:644f623f033c6fdbaacf53c1bc4693bc0650f4fd43b096c24420a3fb8433378c \
   EXPECTED_GIT_SHA=d0cfd3f36b54478767e862280ca8cd38e2bb35df \
   STAGING_BASE_URL=https://<staging-backend> npm run verify:staging-digest
   ```
6. Record deploy UTC + smoke in `staging-pilot-execution.md` and `parity-promotion-evidence.md`.

## Alert webhook deliver/ack (same window)

1. Set `ALERT_WEBHOOK_*` + `METRICS_SCRAPE_TOKEN` on the digest-pinned service.
2. From an authorized host:
   ```bash
   ALERT_FIRE_DRILL_ALLOW=true npm run drill:alert-webhook
   ```
3. Paste deliver/ack timestamps into `docs/observability/alert-review.md`.

## AWS KMS (blocking boot if unset)

`render.yaml` already defaults `DEVICE_SECRET_VAULT_PROVIDER=aws_kms`. Follow
`aws-kms-setup.md`. Workstation has AWS CLI; **credentials still required**.

## Status log

| Date (UTC) | Operator | Digest pinned? | Health release match? | Notes |
|------------|----------|----------------|------------------------|-------|
| 2026-08-12 | Engineering | **No** | Live `gridflex-backend.onrender.com` missing `release.imageDigest` (source rebuild) | RC-2026-08-12 signed `644f623f…378c`; pin this digest |
| 2026-08-03 late | Engineering | **No** | `release:{gitSha:null,imageDigest:null}` | Multi-VU soak Done |
