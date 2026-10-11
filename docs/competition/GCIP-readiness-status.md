# GCIP competition readiness status

Updated: 2026-10-11 evening (UTC) — operator workflows + report/auth/decision persistence on `feat/gcip-dead-buttons-workflows`

## Done in repo

| Item | Status | Evidence |
|------|--------|----------|
| GCIP page + nav | Done | `/gcip`, `/gcip-demo`, sidebar |
| Critical-path e2e incl. GCIP | Done | `e2e/critical-path.spec.ts` |
| Approval queue workflow | Done | Open proposal, reason, reviewer, conditions, approve/reject → `/api/operator-decisions` audit |
| Report centre datasets | Done | KPI, curtailment, recovery, dispatch, forecast, financial, carbon, provenance, decisions CSV |
| Model review workflow | Done | `/model-review` gated steps (dataset→rollback→audit); no in-place retrain |
| Password / sessions | Done | Change password, forgot-password request, session list/revoke, login history, admin MFA ack |
| Recommendation persistence | Done | Approve/dismiss sync to audit API + hydrate on reload |
| Recovery case management | Done | Case number, owner, eng reviewer, attachments, option, energy/revenue, verification, closure |
| Physical execution lock | Done | Config + honesty banners |
| Presentation pack | Done | `docs/competition/*` |

## Blocked externally (deployment)

| Item | Blocker | Next operator action |
|------|---------|----------------------|
| Digest-pinned staging deploy | `RENDER_API_KEY` unset in this environment; staging service ID not confirmed | Add secrets; promote **exactly** `sha256:4684d1faec5352949e40414f0e6a3fcc8b9c3dba9a85774103814fcaf7816fac` (RC-2026-10-08b) — do not rebuild from source |
| Public frontend URL | `gridflexai.onrender.com` previously 404 | Confirm live static host; smoke `/gcip` after login |
| Backend release identity | Live health reports `gitSha: null`, `imageDigest: null` | Digest-pin image so `/health.release` is non-null |
| `/gcip` on public frontend | Depends on frontend publish | Verify after host confirmed |

## Live backend observed 2026-10-11

```json
{
  "status": "ok",
  "dependencies": { "database": "up", "redis": "up" },
  "release": { "gitSha": null, "imageDigest": null }
}
```

Host: `https://gridflex-backend.onrender.com` — healthy, **source-built / not digest-pinned**.

Signed release candidate (must deploy this digest, not a fresh source build):

`sha256:4684d1faec5352949e40414f0e6a3fcc8b9c3dba9a85774103814fcaf7816fac`

## Local git caution

Do **not** casually `git pull` over uncommitted WIP that overlaps remote GCIP files. This workspace branch `feat/gcip-dead-buttons-workflows` was reconciled as tracking origin (ahead of `origin/main`). If another checkout is still “7 commits behind” with overlapping uncommitted GCIP files, back it up, `git fetch`, and reconcile with `git diff` / stash before merge.

## Readiness scores (post this sprint)

| Area | Assessment |
|------|------------|
| Competition story | 94% |
| GCIP Showcase | 92% |
| Recovery demonstration | 93% |
| Safety and honest labelling | 95% |
| Navigation and page coverage | 92% |
| Core software quality | 91% |
| Reporting workflow | 88% |
| Approval workflow | 90% |
| Real customer evidence | 55% |
| Public deployment readiness | 62% |
| Overall GCIP readiness | 90% |
| Production readiness | 74% |

## Honesty rules (non-negotiable)

1. Synthetic / demo results are never described as customer results.
2. Physical execution stays disabled for the competition and telemetry pilot.
3. If release identity is null, say the staging host is source-built.
4. Carbon opportunity figures in reports are labelled illustrative, not verified inventory.
5. MFA acknowledgement is not the same as MFA enforcement at login.
