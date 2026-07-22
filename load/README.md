# Load testing (k6 + Socket.IO)

See `docs/LOAD_TESTING.md`.

```bash
k6 run -e BASE_URL=http://localhost:4000 load/k6/http-health-slo.js
LOAD_SOCKET_OUTPUT=go-live-reports/socket-fanout.json \
  node load/socketio-fanout.mjs --url http://localhost:4000 --clients 20 --duration 10 --await-event

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
