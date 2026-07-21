# Render Setup Checklist (GridFlex)

This checklist provisions backend, frontend, Postgres, and Redis in Render using `render.yaml`.

## 1) Create services from Blueprint

1. Push current branch to GitHub.
2. In Render, click **New** -> **Blueprint**.
3. Select this repository and branch.
4. Confirm Render detects `render.yaml`.
5. Create stack.

## 2) Fill required unsynced variables

After first sync, open the backend and frontend services and set:

- Backend (`gridflex-backend`)
  - `DATABASE_URL=<pooled Neon connection string for application traffic>`
  - `DIRECT_URL=<direct, non-pooler Neon connection string for Prisma migrations>`
  - `CORS_ORIGIN=https://<frontend-domain>`
  - `ADMIN_ALLOWED_EMAILS=<comma-separated-admin-emails>`
  - `OPENWEATHER_API_KEY=<key>`
  - `ACCUWEATHER_API_KEY=<key>` (optional)
  - `OPENAI_API_KEY=<key>` (if AI routes enabled)
- Frontend (`gridflex-frontend`)
  - API requests are proxied through `/api` by `render.yaml`; do not override
    `VITE_API_BASE_URL=/api`.

## 3) Redeploy services

Redeploy both services after env vars are set.

## 4) Post-deploy verification commands

From repo root, run:

```bash
SMOKE_API_BASE_URL=https://<backend-domain> npm run smoke:api
```

Full staging verification:

```bash
STAGING_GO_LIVE_BASE_URL=https://<backend-domain> STAGING_GO_LIVE_EMAIL=<admin-email> STAGING_GO_LIVE_PASSWORD=<admin-password> npm run verify:go-live:staging
```

If this is production:

```bash
PRODUCTION_GO_LIVE_BASE_URL=https://<backend-domain> PRODUCTION_GO_LIVE_EMAIL=<admin-email> PRODUCTION_GO_LIVE_PASSWORD=<admin-password> npm run verify:go-live:production
```

Generate summary after both staging + production reports exist:

```bash
npm run verify:go-live:summary
```

## 5) Render-specific checks

- Backend health:
  - `GET https://<backend-domain>/api/health/live`
  - `GET https://<backend-domain>/api/health`
- Frontend loads and authenticates against backend.
- Socket connection succeeds from frontend domain.
- Prisma migrations succeeded in deploy logs (`prisma migrate deploy`).

## 6) Common fixes

- **502/503 after deploy**
  - Check backend logs for migration or env validation failure.
- **CORS/auth issues**
  - Ensure `CORS_ORIGIN` exactly matches frontend URL (including protocol).
- **Forecast degraded**
  - Verify provider API keys and call `/api/forecast/providers/status`.
