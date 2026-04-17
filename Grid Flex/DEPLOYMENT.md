# GridFlex Deployment Guide

This guide covers production deployment for the backend (`backend/`) and frontend (`/`) on Railway, Render, and Fly.io.

## 1) Production prerequisites

- Provision PostgreSQL (managed database strongly recommended).
- Provision Redis (for forecast cache resilience and lower upstream API pressure).
- Set strong secrets (`JWT_SECRET`, API keys, database credentials).
- Build and run backend from `backend/` with `npm run build && npm run start`.
- Build frontend from repository root with `npm run build` and serve static output.

## 2) Required backend environment variables

- `NODE_ENV=production`
- `PORT` (platform usually injects this)
- `DATABASE_URL=postgresql://...`
- `REDIS_URL=redis://...`
- `JWT_SECRET=<32+ chars>`
- `JWT_ACCESS_EXPIRES_IN=15m`
- `JWT_REFRESH_EXPIRES_IN=30d`
- `CORS_ORIGIN=https://<your-frontend-domain>`
- `EDGE_INGEST_SHARED_SECRET=<shared-hmac-secret>`
- `EDGE_INGEST_MAX_SKEW_SECONDS=300`
- `OPENWEATHER_API_KEY=<key>`
- `ACCUWEATHER_API_KEY=<key>` (optional fallback provider)
- `FORECAST_CIRCUIT_FAILURE_THRESHOLD=3`
- `FORECAST_CIRCUIT_OPEN_MS=180000`

## 3) Railway

1. Create project, connect GitHub repo.
2. Add PostgreSQL and Redis plugins.
3. Set service root:
   - Backend service root: `backend`
   - Frontend service root: repository root
4. Backend start command:
   - Build: `npm run build`
   - Start: `npm run start`
5. Add a pre-deploy migration command:
   - `npx prisma migrate deploy`
6. Frontend:
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Set `VITE_API_BASE_URL=https://<backend-domain>/api`

## 4) Render

1. Create a PostgreSQL instance and Redis instance in Render.
2. Create Web Service for backend:
   - Root directory: `backend`
   - Build command: `npm install && npm run build`
   - Start command: `npm run start`
3. Add environment variables listed above.
4. Add a deploy hook command for migrations:
   - `npx prisma migrate deploy`
5. Create Static Site for frontend:
   - Root directory: repository root
   - Build command: `npm install && npm run build`
   - Publish directory: `dist`
   - Env var: `VITE_API_BASE_URL=https://<backend-service>.onrender.com/api`
6. Optional: use Render Blueprint with `render.yaml` in this repo to provision the stack in one flow.
7. Follow `docs/runbooks/render-setup-checklist.md` for post-provision variable completion and verification.

## 5) Fly.io

1. Install Fly CLI and run `fly launch` separately for backend and frontend.
2. Backend app:
   - Set working directory to `backend`.
   - Configure `internal_port` to your runtime `PORT`.
   - Attach managed PostgreSQL and Redis (or external services).
   - Use release command for migrations:
     - `npx prisma migrate deploy`
3. Frontend app:
   - Build static assets and serve via lightweight static server (or Fly Machines + Caddy/Nginx).
4. Secrets:
   - `fly secrets set JWT_SECRET=... DATABASE_URL=... REDIS_URL=...`
5. Set frontend API env:
   - `VITE_API_BASE_URL=https://<backend-fly-app>.fly.dev/api`

## 6) Post-deploy checklist

- Hit backend liveness endpoint: `GET /api/health/live`.
- Hit backend dependency health endpoint: `GET /api/health`.
- Confirm login + refresh token flow works from browser.
- Confirm Socket.io handshake succeeds from frontend domain.
- Validate forecast diagnostics endpoints:
  - `/api/forecast/providers/status`
  - `/api/forecast/providers/history`
  - `/api/forecast/debug`
- Load test ingestion route with realistic burst traffic to tune rate limits.
- Run API smoke script from repo root:
  - `SMOKE_API_BASE_URL=https://<backend-domain> npm run smoke:api`
