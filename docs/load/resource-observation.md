# Resource observation during load tests

Record for every formal run (staging dashboard / Neon / Redis / host metrics):

| Resource | Tool / source | Notes |
|----------|---------------|-------|
| CPU | Host / Render metrics | App + DB |
| Memory | Process RSS (`gridflex_process_*`) | Watch leaks |
| Event-loop delay | Node diagnostics / APM | |
| Database connections | Neon / Postgres `pg_stat_activity` | Pool saturation |
| Query latency | Neon / Prisma timings | |
| Redis latency | Redis INFO / APM | |
| WebSocket connection count | `gridflex_socket_connections` | |
| Network traffic | Hosting metrics | |
| Storage growth | Neon storage | During soak |

Also capture: `/api/metrics` scrape before/after, structured log error rate, alert firings.
