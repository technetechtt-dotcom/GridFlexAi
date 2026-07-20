# Data Retention and Access Review Policy

## Purpose

Define minimum standards for retaining GridFlex operational data and governing who can access it.

## Data Classes

- Authentication/session metadata
- Telemetry readings and derived analytics
- Forecast provider response metadata
- Audit logs and admin actions

## Retention Baseline

- Auth/session security logs: 180 days
- API request/response metrics: 90 days
- Raw telemetry readings: 365 days
- Aggregated daily analytics: 3 years
- Audit logs: 2 years
- Incident artifacts/postmortems: 2 years

## Access Controls

- Least privilege is mandatory.
- Production data access is role-based and time-bound.
- Elevated access requires ticket + owner approval.
- Shared credentials are prohibited.
- Secrets must be stored in managed secret stores only.

## Review Cadence

- Monthly:
  - review privileged users
  - remove stale/inactive accounts
- Quarterly:
  - validate retention jobs and archive lifecycle
  - sample audit log integrity
- Per release:
  - confirm new tables/streams have retention labels

## Audit Requirements

All privileged access must be logged with:

- actor identity
- timestamp
- action and target resource
- reason/reference ticket

## Exceptions

- Any policy exception needs:
  - written justification
  - explicit end date
  - approval from engineering lead + security owner

## Related policies

- POPIA: [`popia-data-handling-policy.md`](./popia-data-handling-policy.md)
- Access reviews: [`access-review-log.md`](./access-review-log.md)
- Data subject requests: [`data-subject-request-runbook.md`](./data-subject-request-runbook.md)

## Ownership

- Policy owner: Platform/Backend lead
- Review cadence: monthly (access) / quarterly (retention)
- Enforcement owner: DevOps/SRE
- Review approver: Product + Security stakeholders
