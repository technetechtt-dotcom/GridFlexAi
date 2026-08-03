# Access review log

Cadence: **monthly** (privileged users) + **quarterly** (retention/audit sample).  
Policy: [`popia-data-handling-policy.md`](./popia-data-handling-policy.md), [`data-retention-access-policy.md`](./data-retention-access-policy.md).

## Review template

| Field | Value |
|-------|-------|
| Review date | |
| Reviewer | |
| Information Officer / delegate approval | |
| Period covered | |
| Privileged accounts reviewed | |
| Organisation/site memberships sampled | |
| Service accounts, device credentials and API keys reviewed | |
| Accounts disabled / role reduced | |
| Orphaned tokens / API keys revoked | |
| Findings | |
| Source export/query artifact path / SHA-256 | |
| Ticket / evidence-vault URL | |
| Next review due | |

### Software export (prep for review #1)

```bash
cd backend
EXPORT_ACCESS_REVIEW_ALLOW=true DATABASE_URL=<isolated-or-staging> \
  npx tsx scripts/export-privileged-users.ts
```

Writes `go-live-reports/access-review-privileged-export.json` (+ `.sha256`).
Paste the SHA-256 into the template field above. Export is **not** IO approval —
Information Officer sign-off still required to close issue #48.

## History

| Date | Reviewer | Actions taken | Pass? |
|------|----------|---------------|-------|
| _TBD_ | | | |
