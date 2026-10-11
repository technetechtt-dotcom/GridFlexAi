# GCIP competition readiness status

Updated: 2026-10-11 afternoon (UTC) — dead-button / workflow sprint on `feat/gcip-dead-buttons-workflows`

## Done in repo

| Item | Status | Evidence |
|------|--------|----------|
| GCIP page + nav | Done | `/gcip`, `/gcip-demo`, sidebar |
| Critical-path e2e incl. GCIP | Done | `e2e/critical-path.spec.ts` |
| CI on main (GCIP commits) | Green | Actions on `c8e1bf0` / prior |
| Physical execution lock in config | Done | `render.yaml`, CI env, policy doc |
| Presentation script (7 min) | Done | `GCIP-7-minute-presentation.md` |
| Rehearsal checklist | Done | `GCIP-rehearsal-checklist.md` |
| Telemetry-only pilot request | Done | `telemetry-only-pilot-request.md` |
| Offline demo / screenshots guides | Done | competition docs + scripts |
| Warmup + report verify scripts | Done | `npm run warmup:staging`, `verify:recovery-report` |
| Dead buttons on prior P0 list | Implemented or disabled with titles | UX repair on `b15edb3`+ |

## Blocked externally

| Item | Blocker | Next operator action |
|------|---------|----------------------|
| Digest-pinned staging deploy | `RENDER_API_KEY` + `RENDER_STAGING_SERVICE_ID` missing | Add GitHub secrets; re-run **Promote Signed Release To Staging** with RC-2026-10-08b digest `sha256:4684d1fa…16fac` |
| Staging `/gcip` on public frontend | Frontend host not found (`gridflexai.onrender.com` 404); backend health ok but `release` null | Publish frontend static site or confirm live URL; then smoke `/gcip` after login |
| Live video capture | Requires human screen recording at venue/laptop | Follow `offline-demo-recording.md` |

## Live backend observed 2026-10-11

```json
{
  "status": "ok",
  "dependencies": { "database": "up", "redis": "up" },
  "release": { "gitSha": null, "imageDigest": null }
}
```

Host: `https://gridflex-backend.onrender.com` — healthy, **not** digest-pinned.

## Honesty rules (non-negotiable)

1. Synthetic / demo results are never described as customer results.
2. Physical execution stays disabled for the competition and telemetry pilot.
3. If release identity is null, say the staging host is source-built.
