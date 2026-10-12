/** Exact GCIP funding ask for the close slide and printed pilot request. */
export const FUNDING_ASK = {
  amountZar: 1_950_000,
  currency: 'ZAR' as const,
  label: 'R 1,950,000',
  periodDays: 90,
  purpose: '90-day telemetry-only Northern Cape pilot (advisory; physical execution locked)'
};

export const USE_OF_FUNDS: Array<{ item: string; pct: number; zar: number; note: string }> = [
  {
    item: 'Platform hardening & signed ingest',
    pct: 40,
    zar: 780_000,
    note: 'Digest-pinned releases, edge trust, audit trail, operator workflows'
  },
  {
    item: 'Pilot integration & data ops',
    pct: 25,
    zar: 487_500,
    note: 'Telemetry-only onboarding, labelled windows, frozen → site pack migration'
  },
  {
    item: 'Operator engagement',
    pct: 15,
    zar: 292_500,
    note: 'Site outreach, data agreements, training, weekly review rituals'
  },
  {
    item: 'Independent review reserve',
    pct: 10,
    zar: 195_000,
    note: 'External technical review once plant permission is confirmed'
  },
  {
    item: 'Contingency',
    pct: 10,
    zar: 195_000,
    note: 'Travel, unexpected integration costs, buffer'
  }
];

export const PILOT_90_DAY_DELIVERABLES = [
  'Signed telemetry-only data agreement with one willing operator (no brand claim until written permission)',
  'Site-scoped labelled dataset replacing the synthetic pack for at least one curtailment window',
  'Weekly operator review pack: loss cause, confidence, advisory recommendation, human approval record in Postgres',
  'Physical execution remains locked for the full 90 days unless a separate written plant approval is obtained',
  'End-of-pilot report with measured / modelled / estimated / potential classes and clear limitations',
  'Go / no-go recommendation for a subsequent instrumentation or flexible-load phase'
];
