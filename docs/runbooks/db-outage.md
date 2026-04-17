# Runbook: Database Outage

## Trigger

- `/api/health` fails due to database dependency.
- Elevated 5xx on read/write endpoints.

## Immediate Actions

1. Confirm DB connectivity from backend logs and managed DB console.
2. Check whether outage is full DB down, credential issue, or connection pool saturation.
3. Declare incident and pause non-essential writes if required.

## Operator Checks

- `GET /api/health/live` (process health)
- `GET /api/health` (dependency health)
- Managed DB metrics (connections, CPU, storage, failover status)

## Mitigation

- Restart backend instances if stale connections are suspected.
- Fail over to standby (if managed provider supports it).
- If credentials were rotated, update secret store and redeploy immediately.

## Recovery Criteria

- `/api/health` returns 200 consistently.
- 5xx rate drops back to normal baseline.
- Read and write endpoints pass smoke checks.

## Post-Incident

- Run backup restore drill in staging if data integrity concerns exist.
- Document RTO/RPO impact and remediation tasks.
