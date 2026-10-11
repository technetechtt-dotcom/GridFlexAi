# Backup screenshots guide

Capture before the live session. Prefer PNG. Do not commit customer PII.

## Required set

| # | Name | Viewport | Notes |
|---|------|----------|-------|
| 1 | `01-gcip-hero-laptop.png` | 1440×900 | Safe competition mode card visible |
| 2 | `02-gcip-hero-phone.png` | 390×844 | CTA visible without horizontal clip |
| 3 | `03-judge-steps.png` | 1440×900 | Four step cards |
| 4 | `04-recovery-advisory.png` | 1440×900 | Advisory / locked banner visible |
| 5 | `05-recovery-report.png` | 1440×900 | Opened HTML report showing synthetic_demo |
| 6 | `06-physical-lock.png` | 1440×900 | Any screen stating execution locked |

## Automated capture (local)

```bash
npm run capture:gcip-screens
```

Output: `go-live-reports/gcip-screens/` (gitignored).

## Staging note

When a public frontend URL is available, repeat shots 1–3 against that host after login.
Until then, local preview + offline report shots are the competition backup.
