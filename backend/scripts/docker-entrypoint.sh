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

# Neon is dual-stack. Prisma dials AAAA first and does not fall back, which
# is an immediate P1001 on IPv6-less hosts such as Render.
case " ${RES_OPTIONS:-} " in
  *" no-aaaa "*) ;;
  *) export RES_OPTIONS="${RES_OPTIONS:+$RES_OPTIONS }no-aaaa" ;;
esac
eval "$(node scripts/pin-postgres-ipv4.mjs --export)"

./node_modules/.bin/prisma migrate deploy
node dist/scripts/verify-device-secret-vault.js
exec node dist/server.js
