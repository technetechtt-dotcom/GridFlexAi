# Frozen demonstration pack evidence

| Field | Value |
|-------|--------|
| Version | `gcip-demo-2026-10-12.1` |
| Source of truth | `src/lib/pilotCase.ts` (`FROZEN_RETROSPECTIVE_PILOT`) |
| Validation | `validateFrozenPilotCase()` — arithmetic + version checks |
| Site naming | **Synthetic** “GridFlex NC Demo Plant” — no real commercial brand |
| Reviewer | **Internal** GridFlex pilot desk — not an independent auditor |
| Physical intervention | Not claimed |
| Permission for third-party plant names | **Not confirmed** — therefore unused |

## Arithmetic evidence (must remain true)

1. Identified loss = expected − actual = 12860 − 11240 = **1620 MWh**
2. Recoverable = identified − remaining = 1620 − 410 = **1210 MWh**
3. Financial = 1210 × 1000 × 1.55 = **R1,875,500** (estimated)
4. Carbon = 1210 × 1000 × 0.95 / 1000 = **1149.5 tCO₂e** (estimated)

## Impact class map

| Metric | Class |
|--------|--------|
| Actual generation | **Measured (pack)** — synthetic value treated as measured for methodology; not commercial meter settlement |
| Expected generation | Modelled |
| Loss cause | Modelled |
| Recoverable energy | Potential future |
| Financial / carbon | Estimated |

## Change control

Do not edit frozen numbers during a live presentation. Bump `FROZEN_DEMO_PACK_VERSION`, update this file, re-run `node scripts/validate-frozen-demo-pack.mjs`, and regenerate the verified PDF.
