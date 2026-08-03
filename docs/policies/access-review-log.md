# Access review log

Cadence: **monthly** (privileged users) + **quarterly** (retention/audit sample).  
Policy: [`popia-data-handling-policy.md`](./popia-data-handling-policy.md), [`data-retention-access-policy.md`](./data-retention-access-policy.md).

## Review template

| Field | Value |
|-------|-------|
| Review date | 2026-08-03 (export only — **IO approval pending**) |
| Reviewer | Engineering (`@technetechtt-dotcom`) — inventory export |
| Information Officer / delegate approval | **Open — required to close #48** |
| Period covered | Current DB snapshot at export time |
| Privileged accounts reviewed | 4 privileged users / 5 total (see export) |
| Organisation/site memberships sampled | 0 privileged org memberships; 1 privileged site membership |
| Service accounts, device credentials and API keys reviewed | 0 active device credentials; 0 API credentials |
| Accounts disabled / role reduced | _pending IO decision_ |
| Orphaned tokens / API keys revoked | _pending IO decision_ |
| Findings | Export produced against engineering DB; re-run on staging before production closure if IO requires live inventory |
| Source export/query artifact path / SHA-256 | `go-live-reports/access-review-privileged-export.json` · SHA-256 `ac664b53ebbc492f752c2687980219b55d5efb83871550f246eb5d5231447d42` |
| Ticket / evidence-vault URL | GitHub issue #48 |
| Next review due | _set after IO sign-off_ |

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
| 2026-08-03 | Engineering | Privileged inventory export SHA `ac664b53…7d42` | Partial — awaiting IO |
| _TBD_ | Information Officer | Sign policy + approve/remediate accounts | |
