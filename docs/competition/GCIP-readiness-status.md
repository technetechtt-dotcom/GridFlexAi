# GCIP readiness status (canonical pointer)

**Authoritative checklist:** [`ops-assurance-status.md`](./ops-assurance-status.md)

This file previously duplicated readiness notes and drifted (six-step journey, missing funding ask). Use the ops assurance doc plus:

| Topic | Where |
|-------|--------|
| Judge entry | `/gcip?demo=1` → **Start demonstration** → five steps → `/gcip/ask` |
| Funding ask | **R 1,950,000** · `src/lib/fundingAsk.ts` · print from Ask slide |
| Frozen pack | `gcip-demo-2026-10-12.1` · `evidence/frozen-demo-pack.md` |
| Synthetic FAQ | `synthetic-dataset-faq.md` |
| Offline rehearsal | `offline-rehearsal.md` |
| Demo account | `GCIP-demo-account.md` |
| 7-minute script | `GCIP-7-minute-presentation.md` |
| Product info (QR) | `https://gridflex-frontend.onrender.com/product-info` · local asset `/product-info-qr.svg` |

## Presentation-day operator checklist

- [ ] Create/test `gcip.demo@…` account
- [ ] Generate PDF on presentation laptop
- [ ] Run full 7-minute talk **three times**
- [ ] Record backup video of complete journey
- [ ] Rehearse with Wi‑Fi off (`offline-rehearsal.md`)
- [ ] Print one-page pilot request for judges
- [ ] `npm run warmup:staging` 10–15 min before
- [ ] Open product-info URL on a normal phone (camera QR)
