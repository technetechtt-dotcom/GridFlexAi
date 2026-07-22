#!/bin/sh
set -eu

if [ -z "${DIRECT_URL:-}" ]; then
  export DIRECT_URL="$(node scripts/resolve-direct-url.mjs)"
  echo "[entrypoint] DIRECT_URL was unset; derived direct Postgres URL for migrations."
fi

./node_modules/.bin/prisma migrate deploy
exec node dist/server.js
