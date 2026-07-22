# POPIA data-handling policy (Phase 14)

**Status:** Draft for pilot — approve before processing personal information in production.

## Purpose

Set GridFlex obligations under South Africa’s Protection of Personal Information Act (POPIA) for the IPP pilot and related operations.

## Roles

| Role | Assignment |
|------|------------|
| Responsible Party | GridFlex operating entity (legal name TBD) |
| Information Officer | _Name / contact_ |
| Operators (processors) | Hosting (e.g. Render), Neon, Redis provider, AI vendor (if personal data in prompts) — under contracts |

## Lawful processing

Personal information is processed only for:

1. Account authentication and access control
2. Operational telemetry association to sites/assets (business contact where applicable)
3. Support, incident response, and audit
4. Contractual reporting to the plant operator

Marketing use of pilot personal data is **not** authorized without separate consent.

## Categories of information

| Category | Examples | Notes |
|----------|----------|-------|
| Account | name, email, role | Required for login |
| Operational | site membership, audit actions | Least privilege |
| Device/edge | device keys, serials | Not special personal info; still confidential |
| Telemetry | electrical measurements | Typically not PI; treat as confidential plant data |

Avoid collecting ID numbers, biometric data, or children’s data.

## Cross-border transfers

Cloud hosting may process data outside RSA. Document countries/providers and ensure adequate protection (contractual clauses + access controls). List providers:

| Provider | Region(s) | Purpose | Contract/DPA/SCC reference | Data categories | Retention/deletion |
|----------|-----------|---------|----------------------------|-----------------|--------------------|
| | | Database | | | |
| | | App host | | | |
| | | Redis | | | |
| | | AI (if used) | | | |

## Security measures

- Managed secrets + vaulted device credentials (`docs/MANAGED_SECRETS.md`)
- TLS in production; admin HTTPS requirements
- Role-based access; site-scoped tenancy
- Logging with redaction (`docs/OBSERVABILITY.md`)
- Breach readiness: notify Information Officer immediately; assess POPIA s22 notification duties

## Incident and breach contacts

| Role | Name | Contact | Backup / escalation |
|------|------|---------|---------------------|
| Information Officer | | | |
| Security incident lead | | | |
| Legal/privacy adviser | | | |
| Regulator/data-subject notification owner | | | |

The incident record must preserve discovery time, containment time, affected
systems and subjects, risk assessment, notification decision and approval.

## Data subject rights

Requests (access, correction, deletion, objection) follow [`data-subject-request-runbook.md`](./data-subject-request-runbook.md). Target acknowledgement: **5 business days**; completion per complexity within **30 calendar days** unless lawfully extended.

## Retention

See [`data-retention-access-policy.md`](./data-retention-access-policy.md). Purge jobs remain **disabled** until this policy is signed off.

## Access reviews

Monthly privileged-user review using [`access-review-log.md`](./access-review-log.md).

## Approval

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Information Officer | | | |
| Engineering lead | | | |
| Plant representative (pilot) | | | |
