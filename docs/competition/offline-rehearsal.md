# Offline demonstration rehearsal (no internet)

## Goal

Complete the five-step judge journey without relying on Render or venue Wi‑Fi.

## Prep (once, while online)

```bash
npm install
npm run validate:demo-pack
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
```

Keep that preview tab open. Optionally capture screens: `npm run capture:gcip-demo`.

## Offline walk (disconnect Wi‑Fi)

1. Sign in with the local/demo account (mock API works in e2e; for live build use a warmed session already signed in).
2. Open `/gcip?demo=1` → **Start demonstration** (timer starts).
3. Pilot case → Climate → Commercial → AI evidence → **Ask & next** (`/gcip/ask`).
4. Open **Verified pilot PDF** from the ask slide or pilot case — print works offline from the HTML blob.
5. Confirm frozen pack badge `gcip-demo-2026-10-12.1` on the progress bar.

## Backup video

Follow `offline-demo-recording.md`. Store the MP4 outside git; note checksum there after capture.
