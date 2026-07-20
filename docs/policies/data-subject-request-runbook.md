# Data subject request runbook

Use for POPIA access, correction, deletion, or objection requests related to GridFlex accounts.

## Intake

1. Verify requester identity (match account email / formal letterhead).
2. Log ticket with date received, type, and Information Officer CC.
3. Acknowledge within **5 business days**.

## Fulfilment

| Request type | Steps |
|--------------|-------|
| Access | Export user profile, memberships, recent audit actions; exclude other tenants’ data |
| Correction | Update via admin/team APIs; confirm to requester |
| Deletion | Assess legal/operational retention; anonymize or delete account fields; retain audit where required by law |
| Objection | Disable non-essential processing; document |

Never export another organisation’s telemetry or credentials.

## Closure

- Record completion date and artifacts (ticket ID only in public trackers)
- Update [`access-review-log.md`](./access-review-log.md) if privileged access changed

## Escalation

Complex or contested requests → Information Officer within 2 business days.
