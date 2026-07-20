# Load testing (k6 + Socket.IO)

See `docs/LOAD_TESTING.md`.

```bash
k6 run -e BASE_URL=http://localhost:4000 load/k6/http-health-slo.js
node load/socketio-fanout.mjs --url http://localhost:4000 --clients 20 --duration 10
```

Only run against **authorized** staging/HIL environments.
