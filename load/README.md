# Load testing (k6 + Socket.IO)

See `docs/LOAD_TESTING.md`.

```bash
k6 run -e BASE_URL=http://localhost:4000 load/k6/http-health-slo.js
LOAD_SOCKET_OUTPUT=go-live-reports/socket-fanout.json \
  node load/socketio-fanout.mjs --url http://localhost:4000 --namespace /simulation \
  --clients 20 --duration 12 --await-event

node load/socketio-reconnect-storm.mjs --url http://localhost:4000 --token "$JWT" \
  --clients 15 --cycles 4 --output go-live-reports/socket-reconnect-storm.json

# Signed ingest (sequence must fit INT4; prefer 1 VU per credential):
BASE_URL=http://127.0.0.1:4010 \
DEVICE_ID=... DEVICE_CREDENTIAL_ID=... DEVICE_KEY_VERSION=... DEVICE_SECRET_B64URL=... \
INGEST_RPS=2 DURATION=40s PREALLOCATED_VUS=1 MAX_VUS=1 INGEST_P95_MS=15000 SEQUENCE_BASE=1000 \
  k6 run --summary-export go-live-reports/k6-sustained-ingest.json load/k6/sustained-ingest.js

# Redis loss/recovery (requires healthy Docker Redis):
REDIS_CHAOS_ALLOW=true BASE_URL=http://127.0.0.1:4010 node scripts/redis-loss-recovery-drill.mjs

# Accepted sustained ingest: each request is signed independently.
BASE_URL=https://authorized-staging.example \
DEVICE_ID=... DEVICE_CREDENTIAL_ID=... DEVICE_KEY_VERSION=... \
DEVICE_SECRET_B64URL=... INGEST_RPS=60 DURATION=30m \
  k6 run load/k6/sustained-ingest.js

# Burst profile uses the same per-request GRIDFLEX-V1 signing.
INGEST_PROFILE=burst INGEST_RPS=300 \
  k6 run load/k6/sustained-ingest.js

# Exact signed-request replay storm; at most the first request may be accepted.
DEVICE_ID=... DEVICE_CREDENTIAL_ID=... DEVICE_SECRET_B64URL=... \
  k6 run load/k6/replay-duplicate.js
```

Only run against **authorized** staging/HIL environments.
Use a dedicated load-test device credential, supply secrets through the runner's
secret store, never command history or committed files, and revoke it after the
test.
