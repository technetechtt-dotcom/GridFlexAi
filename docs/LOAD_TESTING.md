# Load, ingest and WebSocket testing (Phase 12)

## Tooling

- **Default:** [k6](https://k6.io/) (`load/k6/`)
- **Socket.IO fan-out:** Node script (`load/socketio-fanout.mjs`) using `socket.io-client`
- **Quick HTTP baseline:** `npm run baseline:load` (health-only smoke)

Install k6 separately (not an npm dependency): https://k6.io/docs/get-started/installation/

## Artifacts

| Artifact | Path |
|----------|------|
| Pilot load model + 3× margin | [`docs/load/pilot-load-model.md`](./load/pilot-load-model.md) |
| SLOs / thresholds | [`docs/load/slos.md`](./load/slos.md) |
| Resource observation checklist | [`docs/load/resource-observation.md`](./load/resource-observation.md) |
| Evidence worksheet | [`docs/load/evidence-worksheet.md`](./load/evidence-worksheet.md) |
| Capacity & cost estimates | [`docs/load/capacity-cost-estimates.md`](./load/capacity-cost-estimates.md) |
| k6 scenarios | `load/k6/` |

## Run (staging only, authorized)

```bash
# Sustained ingest (requires EDGE_* test credentials — never commit secrets)
k6 run -e BASE_URL=https://staging-api.example.com load/k6/sustained-ingest.js

k6 run -e BASE_URL=... load/k6/reconnect-burst.js
k6 run -e BASE_URL=... load/k6/replay-duplicate.js
k6 run -e BASE_URL=... -e BEARER_TOKEN=... load/k6/dashboard-reads.js
k6 run -e BASE_URL=... -e BEARER_TOKEN=... load/k6/chart-queries.js
k6 run -e BASE_URL=... load/k6/http-health-slo.js

npm run load:socketio -- --url https://staging-api.example.com --token "$TOKEN" --clients 50
```

Or: `npm run load:k6:smoke` (health SLO script if `k6` is on PATH).

## Acceptance

- SLOs hold at **3×** expected pilot load
- Accepted telemetry neither lost nor duplicated
- Redis failure degrades safely (see reliability docs)
- Recovery needs no manual data repair
- Capacity and cost estimates documented
