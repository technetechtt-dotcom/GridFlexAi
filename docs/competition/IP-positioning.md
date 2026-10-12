# GridFlex AI — IP positioning (GCIP)

The protectable value is **not** the dashboard layout. Layouts, generic charts and commodity UI patterns are weakly protectable and easy to imitate.

## Proprietary / confidential (trade secret + copyright)

| Asset | Why it matters | Suggested protection |
|-------|----------------|----------------------|
| Multi-source loss-attribution methodology | Separates curtailment, equipment failure, data quality and resource shortfall | Trade secret + copyright on docs/code; patent review if novel claim set crystallises |
| Curtailment classification logic | Distinguishes grid export constraint from plant faults using multi-signal evidence | Trade secret; patentability review |
| Recovery recommendation ranking | Maps classified loss → advisory options with confidence and human gates | Trade secret + copyright |
| Baseline & verification methodology | Measured vs modelled vs estimated vs potential classes; audit fields | Trade secret; copyright on report templates |
| Edge-to-cloud trust model | Signed ingest, replay protection, vault-backed secrets, offline continuity | Trade secret + copyright; patent review for novel continuity claims |
| Human-approved operational decision workflow | Approve/reject with reason, release SHA, model version, Postgres audit | Copyright + trade secret process knowledge |
| Integration of curtailment with flexible loads / H₂ opportunity modelling | Sector-coupling advisory pathway | Trade secret; patent review for specific methods |

## Open-source / third-party (not claimed as GridFlex IP)

- React, Express, Prisma, PostgreSQL/Neon, Redis, Socket.IO, Tailwind, Recharts, Cosign/Sigstore tooling, AI SDK providers, standard weather APIs.
- Public algorithms used as building blocks (e.g. clear-sky formulations) remain attributable to their authors; GridFlex claims the **system surrounding** them, not the public formula itself.

## Patent / copyright / trade-secret posture

1. **Copyright** — source code, report templates, pilot evidence packs, and documentation.
2. **Trade secrets** — operating procedures, calibrated thresholds, site-specific models, and unpublished attribution weights. Keep access controlled; do not publish full method cards in public repos when they become customer-critical.
3. **Patents** — consider provisional filings only after claim charts are written for (a) multi-source loss attribution with confidence gating and (b) edge offline continuity + signed catch-up. Do not file on “a dashboard that shows solar KPIs.”
4. **Trademarks** — GridFlex AI brand and product names separately.

## What to say to judges

> Our IP is the methodology that turns multi-source telemetry into a trusted, human-approved recovery decision — not the screens. Every recommendation is auditable, every impact class is labelled, and physical execution stays locked until authorised.
