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

## Warm the stack before judges enter

```bash
# Staging backend (avoids Render cold-start blank screens)
curl -s https://gridflex-backend.onrender.com/api/health/live
curl -s https://gridflex-backend.onrender.com/api/health

# Optional scripted warmup
npm run warmup:staging
```

Keep a laptop tab open on `/gcip?demo=1` and `/pilot-case` so the SPA stays loaded.

## Offline demonstration fallback

If API/Render is unavailable:

1. Open `/pilot-case` — evidence table is embedded (no API required).
2. Open verified pilot PDF from that page.
3. Use `/climate-impact` and `/commercial-value` calculators (client-side).
4. Use `/ai-evidence` for methodology talking points.
5. Read `docs/competition/IP-positioning.md` for IP answers.

Do **not** invent live savings numbers when offline. Stick to the labelled retrospective pack.
