# Production digest-pinned deploy

**Goal:** Production runs only the Cosign-signed image that already passed CI and staging — never a Render source rebuild.

## Service split

| Service | Role | Deploy mode |
|---------|------|-------------|
| `gridflex-backend` | Staging / temporary source builds | `env: node`, `autoDeploy: true`, `REQUIRE_RELEASE_IDENTITY=false` |
| `gridflex-backend-prod` | Production | `runtime: image`, **digest-pinned**, `autoDeploy: false`, `REQUIRE_RELEASE_IDENTITY=true` |

## Pre-deploy gate (required)

1. Identify the image digest that passed CI + staging health checks.
2. Verify Cosign signature locally:

```bash
export IMAGE=ghcr.io/technetechtt-dotcom/gridflex-backend@sha256:<digest>
cosign verify \
  --certificate-identity-regexp='https://github.com/technetechtt-dotcom/GridFlexAi/.github/workflows/.*' \
  --certificate-oidc-issuer='https://token.actions.githubusercontent.com' \
  "$IMAGE"
```

Or use the repo helper:

```bash
IMAGE_DIGEST=sha256:<digest> npm run verify:cosign-image
```

3. Confirm staging reported the same `RELEASE_GIT_SHA` and `RELEASE_IMAGE_DIGEST` on `/api/health`.
4. Only then update `gridflex-backend-prod` image URL to that digest and deploy **manually** (auto-deploy stays off).

## Env on production service

- `REQUIRE_RELEASE_IDENTITY=true`
- `RELEASE_GIT_SHA=<full git sha of the image>`
- `RELEASE_IMAGE_DIGEST=sha256:<digest>`
- `COSIGN_VERIFIED=true` (set only after Cosign verify succeeds)
- Alert webhooks enabled for real destinations

## Post-deploy evidence

```bash
curl -s https://<prod-host>/api/health
# Expect releaseIdentityRequired=true, releaseIdentityValid=true,
# release.gitSha and release.imageDigest matching the pin.
```

Boot also writes a `DeploymentRecord` row (git SHA, digest, latest migration name, deploy time, Cosign flag). Admins can list via `GET /api/admin/deployments`.

## Promotion rule

Never promote by rebuilding from `main` on the production service. Promote **the same digest** that staging validated.
