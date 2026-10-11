# Offline demonstration recording

Use this when staging is slow, digest pin is blocked, or the venue network fails.

## Preferred artifact

1. Screen recording (OBS / Windows Game Bar) of a local rehearsal following `GCIP-7-minute-presentation.md`.
2. Length: 6–7 minutes. Filename suggestion: `gcip-offline-demo-YYYYMMDD.mp4`.
3. Store outside git (large binary). Keep a checksum note here after capture:

| Field | Value |
|-------|-------|
| File | _pending operator capture_ |
| SHA-256 | _pending_ |
| Recorded UTC | _pending_ |
| Data label spoken | synthetic competition scenario |

## Storyboard (if video not yet available)

| Shot | Route | Visual proof |
|------|-------|--------------|
| 1 | `/gcip` | Hero + “Safe competition mode” |
| 2 | Curtailment | Loss / event list |
| 3 | AI Insights | Explain step |
| 4 | Recovery Centre | Ranked options + advisory banner |
| 5 | Report HTML | Offline file open in browser |
| 6 | KPI | Illustrative financial/carbon |

## Offline recovery numbers (deterministic demo)

Generate anytime:

```bash
npm run demo:recovery-solar
npm run verify:recovery-report
```

Evidence lands under `go-live-reports/recovery-demo-*` (gitignored).  
Treat all financial/carbon values as **illustrative synthetic_demo** outputs.
