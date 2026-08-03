# Optional Render Blueprint — signed RC image (staging)

Use this **instead of** the Node `buildCommand` service when you need Gate 10
same-digest promotion. It pins the Cosign-signed image from RC-2026-07-23.

Image:
`ghcr.io/technetechtt-dotcom/gridflex-backend@sha256:accf07fc8326ffa15dd4df647af3175bb36b2d9b587270234247324c7e57c718`

## How to apply

1. In Render → New → Blueprint → point at this file **or** create a Docker/Image
   web service manually with the digest above.
2. Add a GHCR registry credential (PAT with `read:packages`).
3. Paste the same secrets as `render.yaml` (DATABASE_URL, JWT, AWS KMS, etc.).
4. Set release identity:
   - `RELEASE_GIT_SHA=cdcd3e7ae2b5962ba58f990f3249728b164ab560`
   - `RELEASE_IMAGE_DIGEST=sha256:accf07fc8326ffa15dd4df647af3175bb36b2d9b587270234247324c7e57c718`
5. Verify:
   ```bash
   EXPECTED_IMAGE_DIGEST=sha256:accf07fc8326ffa15dd4df647af3175bb36b2d9b587270234247324c7e57c718 \
   EXPECTED_GIT_SHA=cdcd3e7ae2b5962ba58f990f3249728b164ab560 \
   STAGING_BASE_URL=https://<this-service> npm run verify:staging-digest
   ```

Do **not** set autoDeploy from git for this service — image pin must change only
when a new signed RC is frozen.

## Service sketch (Render image runtime)

If your Render account supports `runtime: image` in Blueprints:

```yaml
services:
  - type: web
    name: gridflex-backend-rc
    runtime: image
    image:
      url: ghcr.io/technetechtt-dotcom/gridflex-backend@sha256:accf07fc8326ffa15dd4df647af3175bb36b2d9b587270234247324c7e57c718
    plan: starter
    healthCheckPath: /api/health/live
    envVars:
      - key: NODE_ENV
        value: production
      - key: RELEASE_GIT_SHA
        value: cdcd3e7ae2b5962ba58f990f3249728b164ab560
      - key: RELEASE_IMAGE_DIGEST
        value: sha256:accf07fc8326ffa15dd4df647af3175bb36b2d9b587270234247324c7e57c718
      - key: DEVICE_SECRET_VAULT_PROVIDER
        value: aws_kms
      - key: PHYSICAL_COMMAND_EXECUTION_ENABLED
        value: "false"
      - key: HIL_PLANT_APPROVAL_CONFIRMED
        value: "false"
      - key: PILOT_LOCK_PHYSICAL_EXECUTION
        value: "true"
      - key: ALLOW_SIMULATION_IN_PRODUCTION
        value: "false"
      - key: GRIDFLEX_OPERATING_MODE
        value: PILOT_LIVE
      # Remaining secrets: set in dashboard (DATABASE_URL, JWT_*, AWS_*, ALERT_*, METRICS_*)
```

Operator detail: `docs/runbooks/staging-rc-digest-deploy.md`.
