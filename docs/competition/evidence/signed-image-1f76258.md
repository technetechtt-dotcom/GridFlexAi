# Signed image from Release Backend Image (assurance merge)

| Field | Value |
|-------|--------|
| Workflow run | https://github.com/technetechtt-dotcom/GridFlexAi/actions/runs/38247083265 |
| Git SHA | `1f7625888ffd25e2d588c109741217666486c9d8` |
| Image | `ghcr.io/technetechtt-dotcom/gridflex-backend` |
| Digest | `sha256:d4921bde8c89d599a0af9d49e7be337cac29b414a216db8383f69f202456fb0d` |
| Cosign | Keyless OIDC sign completed in workflow |

## Operator deploy steps

1. Verify: `IMAGE_DIGEST=sha256:d4921bde8c89d599a0af9d49e7be337cac29b414a216db8383f69f202456fb0d npm run verify:cosign-image`
2. On Render `gridflex-backend-prod`, set image URL to the digest above.
3. Set env:
   - `REQUIRE_RELEASE_IDENTITY=true`
   - `RELEASE_GIT_SHA=1f7625888ffd25e2d588c109741217666486c9d8`
   - `RELEASE_IMAGE_DIGEST=sha256:d4921bde8c89d599a0af9d49e7be337cac29b414a216db8383f69f202456fb0d`
   - `COSIGN_VERIFIED=true` only after Cosign verify succeeds
4. Manual deploy (autoDeploy remains false).
