# Capacity and cost estimates (pilot)

Tie to [`docs/runbooks/capacity-cost-guardrails.md`](../runbooks/capacity-cost-guardrails.md).

## Compute

| Component | Staging size | Prod pilot size | 3× headroom note |
|-----------|--------------|-----------------|------------------|
| API instances | | | |
| Postgres (Neon CU) | | | |
| Redis | | | |

## Cost drivers

| Driver | Est. monthly | At 3× load | Mitigation |
|--------|--------------|------------|------------|
| Neon storage + compute | | | Retention policy |
| Redis | | | |
| Render/web | | | |
| Egress | | | |
| Log retention | | | |

## After load test

Update estimates with measured CPU/mem/DB and attach to evidence worksheet. Sign-off: engineering + ops.
