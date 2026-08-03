# Staging RC digest deploy (Gate: signed image on Render)

**Goal:** Run the frozen RC signed image on staging — not a Render source rebuild.

RC-2026-07-23 identity:

| Field | Value |
|-------|-------|
| Commit | `cdcd3e7ae2b5962ba58f990f3249728b164ab560` |
| Image | `ghcr.io/technetechtt-dotcom/gridflex-backend@sha256:accf07fc8326ffa15dd4df647af3175bb36b2d9b587270234247324c7e57c718` |

## Why `render.yaml` alone is insufficient

The Blueprint backend service uses `env: node` + `buildCommand`. That **rebuilds from
git** and does **not** pin the Cosign-signed GHCR digest. Source deploys cannot close
the staging→prod same-digest promotion gate.

## Operator steps (Render UI)

1. Create or convert a **Docker** web service (staging) that pulls from GHCR:
   - Image URL: `ghcr.io/technetechtt-dotcom/gridflex-backend`
   - Tag / digest: pin **`@sha256:accf07fc8326ffa15dd4df647af3175bb36b2d9b587270234247324c7e57c718`**
   - Registry credential: GHCR read token (classic PAT with `read:packages`, or org deploy token)
2. Copy env from the existing Node service (or Blueprint), including:
   - `DEVICE_SECRET_VAULT_PROVIDER=aws_kms` + `AWS_KMS_KEY_ID` / region / IAM keys (**#45**)
   - `ALERT_WEBHOOK_ENABLED=true` + `ALERT_WEBHOOK_URL` / `ALERT_WEBHOOK_TOKEN`
   - `METRICS_SCRAPE_TOKEN`
   - Physical lock flags remain **false** / pilot lock **true**
3. Set release identity (exposed on `/api/health` after this code lands):
   - `RELEASE_GIT_SHA=cdcd3e7ae2b5962ba58f990f3249728b164ab560`
   - `RELEASE_IMAGE_DIGEST=sha256:accf07fc8326ffa15dd4df647af3175bb36b2d9b587270234247324c7e57c718`
4. Deploy → wait for healthy.
5. Verify:
   ```bash
   curl -s https://<staging-backend>/api/health
   # expect release.imageDigest == sha256:accf07fc…c718
   EXPECTED_IMAGE_DIGEST=sha256:accf07fc8326ffa15dd4df647af3175bb36b2d9b587270234247324c7e57c718 \
     STAGING_BASE_URL=https://<staging-backend> npm run verify:staging-digest
   ```
6. Record deploy UTC + smoke in `staging-pilot-execution.md` and `parity-promotion-evidence.md`.

## Alert webhook deliver/ack (same window)

1. Set `ALERT_WEBHOOK_*` + `METRICS_SCRAPE_TOKEN` on the digest-pinned service.
2. From an authorized host:
   ```bash
   ALERT_FIRE_DRILL_ALLOW=true npm run drill:alert-webhook
   ```
   Prefer pointing the drill at the staging webhook URL (or trigger a controlled alert on staging and capture ack).
3. Paste deliver/ack timestamps into `docs/observability/alert-review.md`.

## AWS KMS (blocking boot if unset)

`render.yaml` already defaults `DEVICE_SECRET_VAULT_PROVIDER=aws_kms`. The service will
not stay healthy until CMK + IAM exist — follow `aws-kms-setup.md`. Workstation now has
AWS CLI; **credentials still required**.

## Status log

| Date (UTC) | Operator | Digest pinned? | Health release match? | Notes |
|------------|----------|----------------|------------------------|-------|
| 2026-08-03 late | Engineering | **No** | Live host returns `release:{gitSha:null,imageDigest:null}` after health identity deploy | Multi-VU soak Done; set `RELEASE_*` + pin GHCR digest — see `render-rc-image-blueprint.md` |
| 2026-08-03 | Engineering | **No** | pre-`release` field | Multi-VU health soak evidence recorded |
