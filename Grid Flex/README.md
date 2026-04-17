# GridFlex AI

GridFlex AI is a real-time energy optimization platform for IPPs (Independent Power Producers), with:

- React + Vite frontend dashboard
- Node.js + Express + TypeScript backend
- PostgreSQL + Prisma data layer
- Socket.io real-time telemetry streaming
- Hybrid PV/weather forecast service (Forecast.Solar + OpenWeatherMap + AccuWeather backup)

---

## Project Structure

- `src/` - React frontend
- `backend/src/` - TypeScript backend
- `backend/prisma/` - Prisma schema + seed
- `docker-compose.yml` - local container stack

---

## Prerequisites

- Node.js 20+ (22 recommended)
- Docker Desktop (for containerized local dev)

---

## Local Development (without Docker backend)

### 1) Start database and Redis with Docker

```bash
docker compose up -d postgres redis
```

### 2) Backend setup

```bash
cd backend
copy .env.example .env
npm install
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run prisma:seed
npm run dev
```

Backend runs on `http://localhost:4000`.

### 3) Frontend setup

From repo root:

```bash
npm install
```

Create `.env.local` in repo root:

```env
VITE_API_BASE_URL=http://localhost:4000/api
```

Run frontend:

```bash
npm run dev
```

Frontend runs on `http://localhost:5173`.

---

## Full Docker Stack (PostgreSQL + Redis + Backend)

### 1) Optional API keys (host shell)

```bash
set OPENWEATHER_API_KEY=your_openweather_key
set ACCUWEATHER_API_KEY=your_accuweather_key
```

### 2) Build and run

```bash
docker compose up --build
```

This starts:

- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`
- Backend API: `localhost:4000`

> The backend container runs Prisma migrations on startup.

---

## Prisma Commands

From `backend/`:

- Generate client: `npm run prisma:generate`
- New migration: `npm run prisma:migrate -- --name <migration_name>`
- Deploy migrations: `npm run prisma:deploy`
- Seed data: `npm run prisma:seed`

---

## Frontend E2E (Playwright)

From repo root:

- Install browser runtime once: `npm run e2e:install`
- Run critical-path suite: `npm run e2e`

The suite covers login, dashboard, forecast navigation, dispatch flow, and retry banner recovery.

---

## Seed Data

`backend/prisma/seed.ts` creates:

- Default admin user:
  - email: `admin@gridflex.ai`
  - password: `Admin@12345`
- Sample edge node:
  - `Upington Solar Farm Node` with realistic coordinates
- One sample sensor reading

---

## Key API Endpoints

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`

### Nodes + Readings

- `GET /api/nodes` (auth)
- `GET /api/readings` (auth) - supports `nodeId`, `page`, `pageSize`, `limit`, `startDate`, `endDate`, `windowHours`, `sort`
- `GET /api/readings/summary` (auth) - daily totals + average power
- `POST /api/edge-data` (public ingestion endpoint for ESP32, HMAC-signed)
  - auto-associates readings to per-device nodes when `x-gridflex-device-id` is present

### Forecast

- `GET /api/forecast?lat=&lon=&capacity=&tilt=&azimuth=`
- `GET /api/forecast/providers/status` (auth)
- `GET /api/forecast/providers/history` (auth)
- `GET /api/forecast/daily-predictions` (auth) - persisted cron-generated daily forecast history

### Health

- `GET /api/health`
- `GET /api/health/live`

---

## Hybrid Forecast Logic

The backend forecast service is intentionally layered:

1. **Forecast.Solar (primary)** for PV power profile (`estimatedPowerKw`)
2. **OpenWeatherMap (enrichment)** for cloud cover, temperature, and irradiance estimates
3. **AccuWeather (backup-only)** for temperature fallback when other data is missing

### Caching

- In-memory cache (`node-cache`) with TTL
- Redis-backed cache (when `REDIS_URL` is configured)
- Cache TTL defaults to ~45 minutes

### Rate-Limit and Fallback Behavior

- Per-provider circuit breakers prevent repeated failing calls
- HTTP 429 (rate limit) is handled gracefully
- Response includes `meta.fallbackMessages` for transparent fallback diagnostics

---

## Environment Variables (Backend)

See `backend/.env.example` for all values. Important keys:

- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_ACCESS_EXPIRES_IN`
- `JWT_REFRESH_EXPIRES_IN`
- `CORS_ORIGIN`
- `EDGE_INGEST_SHARED_SECRET`
- `EDGE_INGEST_MAX_SKEW_SECONDS`
- `REDIS_URL`
- `OPENWEATHER_API_KEY`
- `ACCUWEATHER_API_KEY`
- `FORECAST_CIRCUIT_FAILURE_THRESHOLD`
- `FORECAST_CIRCUIT_OPEN_MS`
- `EDGE_RATE_LIMIT_MAX_PER_MINUTE`
- `FORECAST_RATE_LIMIT_MAX_PER_MINUTE`
- `FORECAST_CRON_ENABLED`
- `FORECAST_CRON_SCHEDULE`

---

## Frontend Integration Notes

- Use `VITE_API_BASE_URL=http://localhost:4000/api`
- The dashboard consumes:
  - REST endpoints for auth/readings/forecast
  - Socket.io events:
    - `live-reading`
    - `node-status-update`
    - `new-node`

---

## Troubleshooting

- If forecast providers show degraded:
  - verify API keys
  - check provider rate limits
  - inspect:
    - `GET /api/forecast/providers/status`
    - `GET /api/forecast/providers/history`
- If backend can't connect to DB:
  - ensure `postgres` container is healthy
  - validate `DATABASE_URL`
- If edge ingestion returns `401`:
  - verify headers: `x-gridflex-device-id`, `x-gridflex-timestamp`, `x-gridflex-nonce`, `x-gridflex-signature`
  - ensure signature uses HMAC-SHA256 over `deviceId.timestamp.nonce.canonicalJson(body)`
  - see ESP32 reference snippet: `backend/examples/esp32_edge_hmac_example.ino`
  - see ArduinoJson + sorted canonical serializer variant: `backend/examples/esp32_edge_hmac_arduinojson_example.ino`
  - validate implementation against known test vector: `backend/examples/edge_hmac_test_vector.md`

## Operational Runbooks

- Forecast provider outage: `docs/runbooks/provider-outage.md`
- Database outage: `docs/runbooks/db-outage.md`
- Secret rotation: `docs/runbooks/secret-rotation.md`
- Release rollback: `docs/runbooks/release-rollback.md`
- Canary/blue-green rollout: `docs/runbooks/canary-blue-green-rollout.md`
- Failure drill program: `docs/runbooks/failure-drill-program.md`
- Capacity/cost guardrails: `docs/runbooks/capacity-cost-guardrails.md`
- Data retention/access policy: `docs/policies/data-retention-access-policy.md`
- Operator command sheet: `docs/runbooks/operator-command-sheet.md`
- Render setup checklist: `docs/runbooks/render-setup-checklist.md`

## Readiness Automation Commands

- Generate env-key templates from backend schema:
  - `npm run env:templates`
- Env parity check:
  - `npm run check:env-parity`
- Go-live verification:
  - `GO_LIVE_BASE_URL=https://<backend-domain> npm run verify:go-live`
  - `GO_LIVE_BASE_URL=https://<backend-domain> GO_LIVE_EMAIL=<admin-email> GO_LIVE_PASSWORD=<admin-password> GO_LIVE_OUTPUT_FILE=go-live-verification.json npm run verify:go-live`
  - `GO_LIVE_BASE_URL=https://<backend-domain> GO_LIVE_EMAIL=<admin-email> GO_LIVE_PASSWORD=<admin-password> npm run verify:go-live:full` (strict mode)
  - `STAGING_GO_LIVE_BASE_URL=https://<staging-backend-domain> STAGING_GO_LIVE_EMAIL=<admin-email> STAGING_GO_LIVE_PASSWORD=<admin-password> npm run verify:go-live:staging`
  - `PRODUCTION_GO_LIVE_BASE_URL=https://<production-backend-domain> PRODUCTION_GO_LIVE_EMAIL=<admin-email> PRODUCTION_GO_LIVE_PASSWORD=<admin-password> npm run verify:go-live:production`
  - `npm run verify:go-live:summary` (creates `go-live-reports/summary.md`)

---

## Production Deployment

- See `DEPLOYMENT.md` for production deployment runbooks for Railway, Render, and Fly.io.
- See `PRODUCTION_READINESS.md` for the prioritized go-live hardening tracker (P0/P1/P2).
