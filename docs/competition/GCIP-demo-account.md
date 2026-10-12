# GCIP demo account & offline fallback

## Reliable demo account (staging)

Create (or confirm) an invite-only operator account used only for presentations:

| Field | Value |
|-------|--------|
| Email | `gcip.demo@gridflex.ai` |
| Role | `operator` or `manager` |
| Password | Set via admin invite / forced reset; store in team password manager — never commit |
| Mode | Presentation / demo mode ON (`?demo=1` or sidebar toggle) |

Admin steps:

1. `POST /api/admin/invitations` with email + role.
2. Register with invitation token on `/login`.
3. Confirm sessions on `/settings`.
4. Bookmark `/gcip?demo=1` as the cold-start entry.
5. Click **Start demonstration** (starts 7:00 timer) → Pilot → Climate → Commercial → AI evidence → Ask & next → Verified PDF.
6. Confirm the progress bar shows frozen pack `gcip-demo-2026-10-12.1`.

## Claims allowed in the talk

- Synthetic Northern Cape–style demo plant (frozen pack `gcip-demo-2026-10-12.1`)
- Internal GridFlex pilot-desk review (not independent audit)
- Advisory only; physical execution locked
- Impact classes labelled measured / modelled / estimated / potential

## Claims not allowed

- Any real commercial plant brand (permission not confirmed)
- “Independent reviewer” language
- “Verified customer savings” unless measured approval exists in Postgres

## Warm the stack before judges enter

```bash
curl -s https://gridflex-backend.onrender.com/api/health/live
curl -s https://gridflex-backend.onrender.com/api/health
npm run warmup:staging
npm run validate:demo-pack
```

Keep a laptop tab open on `/gcip?demo=1` and `/pilot-case`.

## Offline demonstration fallback

If API/Render is unavailable:

1. Open `/pilot-case` — evidence table is embedded (no API required).
2. Open verified pilot PDF from that page.
3. Use `/climate-impact` and `/commercial-value` calculators (client-side).
4. Use `/ai-evidence` for methodology talking points.
5. Use screenshot pack under `docs/competition/evidence/screens/` if captured.

## Screenshot backup

```bash
npm run e2e:install
# with frontend running:
BASE_URL=http://localhost:5173 npm run capture:gcip-demo
```
