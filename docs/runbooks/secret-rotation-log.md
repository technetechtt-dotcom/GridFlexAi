# Secret rotation log

Append-only. **Never** paste secret values.

| Timestamp (UTC) | Operator | Secret(s) | Environment | Result | Notes / ticket |
|-----------------|----------|-----------|-------------|--------|----------------|
| _example_ 2026-07-20T10:00:00Z | _name_ | JWT kid v1→v2 | staging | success | Rehearsal |
| 2026-07-21T08:43:01Z | operator request | All refresh sessions (38 active) | production | success | Revoked in DB; audit action `auth.refresh_tokens.rotate_all`; users must sign in again |
| 2026-07-21 | operator request | Device credentials | production | not applicable | Inventory found 0 current device credentials |
| 2026-07-21 | operator request | API credentials | production | not applicable | Inventory found 0 API credentials |
| | | Remaining external credentials | production | pending | Rotate JWT, database, Redis, AWS IAM, weather/AI/webhook keys in their owning consoles |

## Emergency rehearsals

| Date | Scenario | Operator | Pass? | Lessons |
|------|----------|----------|-------|---------|
| _TBD_ | Simulated JWT exposure | | | |
| _TBD_ | Simulated device secret leak | | | |
