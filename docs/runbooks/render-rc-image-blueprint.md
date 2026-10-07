# Optional Render Blueprint — signed RC image (staging)

Use this **instead of** the Node `buildCommand` service when you need Gate 10
same-digest promotion. It pins the Cosign-signed image from RC-2026-10-08.

Image:
`ghcr.io/technetechtt-dotcom/gridflex-backend@sha256:c2ec24db972b4f48b80d92c8d4d130d0a9a9324d90fe436799bd082a94bd8a74`

> After apt OS CVE remediation lands, replace this digest with the newest signed RC digest from `docs/releases/RC-2026-10-08.md` (or successor tag) before deploying.

## How to apply

1. In Render → New → Blueprint **or** create a Docker/Image web service with the digest above.
2. Add a GHCR registry credential (PAT with `read:packages`).
3. Paste the same secrets as `render.yaml` (DATABASE_URL, JWT, AWS KMS, etc.).
4. Set release identity:
   - `RELEASE_GIT_SHA=7ff9219da5e2b5f934fc233b7b1fcd12ed0dae78`
   - `RELEASE_IMAGE_DIGEST=sha256:c2ec24db972b4f48b80d92c8d4d130d0a9a9324d90fe436799bd082a94bd8a74`
5. Verify:
   ```bash
   EXPECTED_IMAGE_DIGEST=sha256:c2ec24db972b4f48b80d92c8d4d130d0a9a9324d90fe436799bd082a94bd8a74 \
   EXPECTED_GIT_SHA=7ff9219da5e2b5f934fc233b7b1fcd12ed0dae78 \
   STAGING_BASE_URL=https://<this-service> npm run verify:staging-digest
   ```

Do **not** set autoDeploy from git for this service — image pin must change only
when a new signed RC is frozen.

## Service sketch (Render image runtime)

```yaml
services:
  - type: web
    name: gridflex-backend-rc
    runtime: image
    image:
      url: ghcr.io/technetechtt-dotcom/gridflex-backend@sha256:c2ec24db972b4f48b80d92c8d4d130d0a9a9324d90fe436799bd082a94bd8a74
    plan: starter
    healthCheckPath: /api/health/live
    envVars:
      - key: NODE_ENV
        value: production
      - key: RELEASE_GIT_SHA
        value: 7ff9219da5e2b5f934fc233b7b1fcd12ed0dae78
      - key: RELEASE_IMAGE_DIGEST
        value: sha256:c2ec24db972b4f48b80d92c8d4d130d0a9a9324d90fe436799bd082a94bd8a74
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
