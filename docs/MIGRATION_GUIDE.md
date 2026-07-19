# Migration Guide — Foundation Production Hardening (PR 1)

## Apply database changes

From `backend/`:

```bash
npx prisma migrate deploy
# or during development with drift:
npx prisma db push
npx prisma generate
npm run prisma:seed
```

Production seed requires:

```bash
SEED_ADMIN_PASSWORD=...
SEED_DEVELOPER_PASSWORD=...
```

Do not commit these values.

## Environment changes

| Variable | Purpose | Production expectation |
|----------|---------|------------------------|
| `EDGE_ALLOW_LEGACY_SHARED_SECRET` | Temporary shared HMAC secret | `false` |
| `EDGE_REPLAY_REQUIRE_REDIS` | Force Redis for replay protection | `true` recommended |
| `EDGE_ALLOW_MEMORY_REPLAY` | Allow in-process nonce cache | `false` recommended |
| `REDIS_URL` | Shared replay + forecast cache | required for multi-instance |
| `NODE_HEALTH_CRON_ENABLED` | Background node health evaluator | `true` |
| `PHYSICAL_COMMAND_EXECUTION_ENABLED` | Plant actuation | must remain `false` |

The production Docker Compose deployment also requires `POSTGRES_PASSWORD`,
`DATABASE_URL`, `JWT_SECRET`, and an HTTPS `CORS_ORIGIN` to be supplied by the
deployment environment. Compose intentionally has no production credential
defaults. Keep secrets in the deployment secret store, not in a checked-in
`.env` file.

## API additions

- `GET /api/plants`
- `POST /api/plants` (admin/developer)
- `GET /api/plants/:plantId/assets`
- `POST /api/plants/:plantId/assets`
- `PATCH /api/assets/:assetId/parent`
- `POST /api/assets/link-edge-node`
- `POST /api/v2/telemetry/batch`
- `GET /api/v2/telemetry/readings`
- `POST /api/admin/nodes/:edgeNodeId/credentials` (secret shown once)
- `GET /api/admin/nodes/:edgeNodeId/credentials`
- `POST /api/admin/credentials/:credentialId/revoke`

## Rollback

1. Redeploy previous backend/frontend artifacts.
2. Do not drop new tables in emergency rollback; leave additive schema in place.
3. Re-enable `EDGE_ALLOW_LEGACY_SHARED_SECRET=true` only for temporary recovery.

## Data labelling

Seeded Northern Cape plant/assets are marked `simulated`. Simulation pages show a persistent Simulation banner.
