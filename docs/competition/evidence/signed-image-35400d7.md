# Signed image from Release Backend Image (pre-fixup commit)

| Field | Value |
|-------|--------|
| Workflow run | https://github.com/technetechtt-dotcom/GridFlexAi/actions/runs/38242990580 |
| Git SHA | `35400d704251b5e3577c26a33f7b0ed79ceb09df` |
| Image | `ghcr.io/technetechtt-dotcom/gridflex-backend` |
| Digest (from SBOM artifact name) | `sha256:a2d8c9b833dedab8ed5b7d7f45dd7288502aa93daf6d22d890c5edab549d7c09` |
| Cosign | Keyless OIDC sign completed in workflow |
| SBOM artifact | `technetechtt-dotcom-gridflex-backend_sha256_a2d8c9b833dedab8ed5b7d7f45dd7288502aa93daf6d22d890c5edab549d7c09.spdx.json` |

## Operator deploy steps

1. Verify: `IMAGE_DIGEST=sha256:a2d8c9b833dedab8ed5b7d7f45dd7288502aa93daf6d22d890c5edab549d7c09 npm run verify:cosign-image`
2. On Render `gridflex-backend-prod`, set image URL to the digest above.
3. Set env:
   - `REQUIRE_RELEASE_IDENTITY=true`
   - `RELEASE_GIT_SHA=35400d704251b5e3577c26a33f7b0ed79ceb09df`
   - `RELEASE_IMAGE_DIGEST=sha256:a2d8c9b833dedab8ed5b7d7f45dd7288502aa93daf6d22d890c5edab549d7c09`
   - `COSIGN_VERIFIED=true` only after Cosign verify succeeds
4. Manual deploy (autoDeploy remains false).

**Note:** A newer commit may supersede this image. After merging honesty/test fixes, re-run **Release Backend Image** and replace the digest.
