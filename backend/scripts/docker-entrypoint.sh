#!/bin/sh
set -eu

if [ -z "${DIRECT_URL:-}" ]; then
  export DIRECT_URL="$(node scripts/resolve-direct-url.mjs)"
  echo "[entrypoint] DIRECT_URL was unset; derived direct Postgres URL for migrations."
fi

# Expose release identity on /api/health when operators pin a signed image digest.
# Prefer explicit RELEASE_* env; fall back to common CI/build injects when present.
if [ -z "${RELEASE_GIT_SHA:-}" ] && [ -n "${GIT_COMMIT:-}" ]; then
  export RELEASE_GIT_SHA="$GIT_COMMIT"
fi
if [ -z "${RELEASE_GIT_SHA:-}" ] && [ -n "${RENDER_GIT_COMMIT:-}" ]; then
  export RELEASE_GIT_SHA="$RENDER_GIT_COMMIT"
fi
if [ -z "${RELEASE_IMAGE_DIGEST:-}" ] && [ -n "${IMAGE_DIGEST:-}" ]; then
  export RELEASE_IMAGE_DIGEST="$IMAGE_DIGEST"
fi

./node_modules/.bin/prisma migrate deploy
exec node dist/server.js
