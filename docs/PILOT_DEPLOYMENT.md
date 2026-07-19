# Pilot Deployment

## Health checks

- Liveness: `GET /api/health/live`
- Readiness: `GET /api/health/ready`
- Dependencies: `GET /api/health`

## SLO stubs

| Signal | Target |
|--------|--------|
| API availability | 99.5% monthly |
| Readiness success | 99.9% |
| Alarm ingest latency | p95 < 5s |
