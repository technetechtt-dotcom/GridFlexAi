# GCIP rehearsal checklist

Date: ________  Presenter: ________  Backup: ________

## Safety gates (before every rehearsal)

- [ ] `PILOT_LOCK_PHYSICAL_EXECUTION=true` (staging + local)
- [ ] `PHYSICAL_COMMAND_EXECUTION_ENABLED=false`
- [ ] UI shows advisory / simulation banners on Recovery and Dispatch
- [ ] No claim of customer settlement results

## Warm-up (T−15 min)

```bash
npm run warmup:staging
# or: BASE_URL=https://gridflex-backend.onrender.com npm run warmup:staging
```

- [ ] `/api/health` → status ok, database up, redis up
- [ ] Note `release.gitSha` / `release.imageDigest` (may be null on source-built host — say so honestly)
- [ ] Login works; GCIP route loads (`/gcip` or `/gcip-demo`)

## Device passes

| Device | Viewport | GCIP hero | Recovery CTA | Sidebar / drawer | Pass? |
|--------|----------|-----------|--------------|------------------|-------|
| Laptop | ≥1280×800 | | | | |
| Phone | 390×844 | | | | |

## Presentation dry-run

- [ ] Read full 7-minute script once with timer
- [ ] Download recovery report and open offline
- [ ] `npm run verify:recovery-report -- <path-to-html>`
- [ ] Backup screenshots folder reviewed
- [ ] Offline recording / storyboard ready if network fails

## Dead-control scan (presentation path only)

- [ ] GCIP → Recovery demonstration
- [ ] GCIP → Blueprint
- [ ] Detect / Explain / Recover / Prove step cards
- [ ] Recovery report download
- [ ] No hover-only dead buttons on those screens

## Staging honesty card

If digest is not pinned:

> “Staging API is healthy but still source-built (`release` null). Signed RC image pin is blocked until Render credentials are configured.”
