/**
 * Frozen GCIP demonstration pilot case.
 *
 * Data freeze: FROZEN_DEMO_PACK_VERSION below. Do not edit numbers for a live talk
 * without bumping the version and regenerating evidence under docs/competition/evidence/.
 *
 * Site naming: this is a **synthetic demonstration plant**. No commercial affiliation
 * with any real plant operator (including any similarly named Northern Cape sites) is
 * claimed. Permission to use third-party brand names has not been confirmed — therefore
 * no real plant brand is used.
 */

export type ImpactClass = 'measured' | 'modelled' | 'estimated' | 'potential';

/** Bump when demonstration numbers or methodology text change. */
export const FROZEN_DEMO_PACK_VERSION = 'gcip-demo-2026-10-12.1';

export type PilotCase = {
  id: string;
  frozenVersion: string;
  title: string;
  mode: 'retrospective_pilot';
  modeLabel: string;
  site: {
    name: string;
    region: string;
    country: string;
    installedCapacityMWp: number;
    technology: string;
  };
  monitoring: {
    start: string;
    end: string;
    days: number;
    dataCompletenessPct: number;
  };
  generation: {
    actualMWh: number;
    expectedMWh: number;
    actualClass: ImpactClass;
    expectedClass: ImpactClass;
  };
  loss: {
    identifiedMWh: number;
    remainingMWh: number;
    causeCode: string;
    causeLabel: string;
    causeClass: ImpactClass;
  };
  recommendation: {
    id: string;
    summary: string;
    confidence: number;
    inputs: string[];
    why: string;
    lowConfidenceBehaviour: string;
  };
  action: {
    taken: string;
    approvedBy: string;
    approvedAt: string;
    status: 'advisory_approved' | 'physically_executed';
  };
  impact: {
    recoveredOrRecoverableMWh: number;
    impactClass: ImpactClass;
    tariffZarPerKwh: number;
    financialValueZar: number;
    financialClass: ImpactClass;
    emissionsFactorKgPerKwh: number;
    avoidedCo2t: number;
    carbonClass: ImpactClass;
  };
  reviewer: {
    name: string;
    role: string;
    confirmation: string;
    confirmedAt: string;
  };
  assumptions: string[];
  limitations: string[];
  baselineMethodology: string;
  evidenceNotes: string[];
};

/**
 * Synthetic Northern Cape–style retrospective window for GCIP demonstration.
 * Figures are internally consistent with the climate-impact formulas and are
 * labelled measured / modelled / estimated / potential. They are not customer
 * settlement results and are not tied to a named commercial plant.
 */
export const FROZEN_RETROSPECTIVE_PILOT: PilotCase = {
  id: 'gcip-nc-demo-2024-q4-retrospective',
  frozenVersion: FROZEN_DEMO_PACK_VERSION,
  title: 'Northern Cape demo plant — retrospective curtailment recovery pilot',
  mode: 'retrospective_pilot',
  modeLabel:
    'Retrospective pilot — synthetic demonstration dataset (not a live plant intervention; not a named commercial site)',
  site: {
    name: 'GridFlex NC Demo Plant (synthetic portfolio)',
    region: 'Northern Cape (illustrative)',
    country: 'South Africa',
    installedCapacityMWp: 75,
    technology: 'Utility PV · single-axis tracking (demonstration profile)'
  },
  monitoring: {
    start: '2024-10-01',
    end: '2024-10-31',
    days: 31,
    dataCompletenessPct: 97.4
  },
  generation: {
    actualMWh: 11240,
    expectedMWh: 12860,
    actualClass: 'measured',
    expectedClass: 'modelled'
  },
  loss: {
    identifiedMWh: 1620,
    remainingMWh: 410,
    causeCode: 'grid_export_constraint',
    causeLabel: 'Grid export constraint / curtailment (not equipment failure)',
    causeClass: 'modelled'
  },
  recommendation: {
    id: 'rec-shift-flexible-load-window',
    summary:
      'Shift flexible offtake / storage charge into the constrained export window to recover curtailment energy without raising export above the grid limit.',
    confidence: 0.82,
    inputs: [
      'Measured inverter AC export (15-min)',
      'Plant nameplate and export limit',
      'Irradiance / clear-sky expected generation model',
      'Grid constraint schedule signals',
      'Historical similar-event outcomes'
    ],
    why: 'Expected generation exceeded measured export while irradiance and inverter status remained healthy, classifying the gap as curtailment rather than equipment failure.',
    lowConfidenceBehaviour:
      'When confidence < 0.65 the system only proposes a review task; it never auto-approves and never arms physical execution.'
  },
  action: {
    taken:
      'Internal GridFlex pilot desk approved the advisory recommendation and opened a recovery work order. Physical plant execution remained locked (PILOT_LOCK_PHYSICAL_EXECUTION=true).',
    approvedBy: 'GridFlex internal technical reviewer (pilot desk)',
    approvedAt: '2024-11-04T14:22:00Z',
    status: 'advisory_approved'
  },
  impact: {
    recoveredOrRecoverableMWh: 1210,
    impactClass: 'potential',
    tariffZarPerKwh: 1.55,
    financialValueZar: 1_875_500,
    financialClass: 'estimated',
    emissionsFactorKgPerKwh: 0.95,
    avoidedCo2t: 1149.5,
    carbonClass: 'estimated'
  },
  reviewer: {
    name: 'GridFlex internal technical reviewer',
    role: 'Internal pilot-desk confirmation (not an independent third-party auditor)',
    confirmation:
      'Internal review confirmed that numbers are derived from the frozen synthetic demonstration dataset, that physical execution was not claimed, that measured vs modelled vs estimated classes are correctly marked, and that no real commercial site brand is asserted.',
    confirmedAt: '2024-11-05T09:10:00Z'
  },
  assumptions: [
    'Expected generation uses site capacity × resource model calibrated to the monitoring window.',
    'Tariff R1.55/kWh is an illustrative applicable offtake rate for value estimation — not a billed invoice.',
    'Emissions factor 0.95 kgCO₂e/kWh is an illustrative SA grid displacement factor for demonstration; replace with a certified factor for customer claims.',
    'Recoverable energy assumes flexible load / storage availability during constrained intervals.',
    'Within this synthetic pack, “measured” means the pack treats the value as if it were measured export (for methodology drill) — not a third-party meter reading from a commercial plant.'
  ],
  limitations: [
    'No physical intervention was executed on a live plant during this retrospective pilot.',
    'Financial and carbon figures are estimated from recoverable energy, not settled customer savings.',
    'Dataset is synthetic / demonstration — not a claim of telemetry from a named commercial operator.',
    '“Measured” labels inside the pack are pack-semantics only; they are not independent settlement or audited site meters.',
    'Internal reviewer confirmation is not an independent external audit.'
  ],
  baselineMethodology:
    'Baseline loss = modelled expected generation − pack-“measured” actual export during healthy inverter intervals. Remaining loss = post-recommendation residual. Recovered/recoverable = baseline loss − remaining loss.',
  evidenceNotes: [
    'Arithmetic check: 12860 − 11240 = 1620 MWh identified loss.',
    'Arithmetic check: 1620 − 410 = 1210 MWh recoverable.',
    'Financial check: 1210 × 1000 × 1.55 = R1,875,500.',
    'Carbon check: 1210 × 1000 × 0.95 / 1000 = 1149.5 tCO₂e.',
    'Measured (pack): actual generation 11,240 MWh is synthetic but classed measured for methodology practice.',
    `Frozen pack version: ${FROZEN_DEMO_PACK_VERSION}.`
  ]
};

/** @deprecated Use FROZEN_RETROSPECTIVE_PILOT. Alias retained for older imports; not a brand claim. */
export const PRIESKA_RETROSPECTIVE_PILOT = FROZEN_RETROSPECTIVE_PILOT;

export const IMPACT_CLASS_LABEL: Record<ImpactClass, string> = {
  measured: 'Measured (pack)',
  modelled: 'Modelled',
  estimated: 'Estimated',
  potential: 'Potential future'
};

/** Short judge-facing definitions for impact classes. */
export const IMPACT_CLASS_HELP: Record<ImpactClass, string> = {
  measured:
    'In this synthetic pack: treated as measured export for methodology drill — not a commercial meter settlement.',
  modelled: 'Derived from a resource / capacity model for the same window.',
  estimated: 'Calculated from recoverable energy × illustrative tariff or emissions factor.',
  potential: 'Recoverable if flexible load / storage is available — not yet achieved savings.'
};

export function computeClimateImpact(input: {
  baselineLossKwh: number;
  remainingLossKwh: number;
  tariffZarPerKwh: number;
  emissionsFactorKgPerKwh: number;
}) {
  const recoveredKwh = Math.max(0, input.baselineLossKwh - input.remainingLossKwh);
  const financialValueZar = recoveredKwh * input.tariffZarPerKwh;
  const avoidedCo2t = (recoveredKwh * input.emissionsFactorKgPerKwh) / 1000;
  return { recoveredKwh, financialValueZar, avoidedCo2t };
}

export function computeCommercialValue(input: {
  energyLossKwhThisMonth: number;
  tariffZarPerKwh: number;
  recoverableFraction: number;
  edgeInstallFeeZar: number;
  monthlySubscriptionZar: number;
  performanceFeePct: number;
  verifiedSavingsZarToDate: number;
}) {
  const randValueOfLoss = input.energyLossKwhThisMonth * input.tariffZarPerKwh;
  const recoverableValue = randValueOfLoss * input.recoverableFraction;
  const performanceFee = recoverableValue * (input.performanceFeePct / 100);
  const gridflexFeeThisMonth = input.monthlySubscriptionZar + performanceFee;
  const estimatedCustomerReturn = Math.max(0, recoverableValue - gridflexFeeThisMonth);
  const annualisedCustomerReturn = estimatedCustomerReturn * 12;
  const paybackMonths =
    annualisedCustomerReturn > 0 ? input.edgeInstallFeeZar / (annualisedCustomerReturn / 12) : null;

  return {
    energyLossKwhThisMonth: input.energyLossKwhThisMonth,
    randValueOfLoss,
    recoverableValue,
    gridflexFeeThisMonth,
    estimatedCustomerReturn,
    paybackMonths,
    verifiedSavingsZarToDate: input.verifiedSavingsZarToDate,
    breakdown: {
      edgeInstallFeeZar: input.edgeInstallFeeZar,
      monthlySubscriptionZar: input.monthlySubscriptionZar,
      performanceFeePct: input.performanceFeePct,
      performanceFeeZar: performanceFee
    }
  };
}

/** Runtime validation of frozen pack arithmetic — used by unit checks and offline rehearsal. */
export function validateFrozenPilotCase(pilot: PilotCase = FROZEN_RETROSPECTIVE_PILOT): string[] {
  const errors: string[] = [];
  const identified = pilot.generation.expectedMWh - pilot.generation.actualMWh;
  if (Math.abs(identified - pilot.loss.identifiedMWh) > 0.01) {
    errors.push(`identified loss mismatch: expected ${identified}, got ${pilot.loss.identifiedMWh}`);
  }
  const recoverable = pilot.loss.identifiedMWh - pilot.loss.remainingMWh;
  if (Math.abs(recoverable - pilot.impact.recoveredOrRecoverableMWh) > 0.01) {
    errors.push(
      `recoverable mismatch: expected ${recoverable}, got ${pilot.impact.recoveredOrRecoverableMWh}`
    );
  }
  const financial = pilot.impact.recoveredOrRecoverableMWh * 1000 * pilot.impact.tariffZarPerKwh;
  if (Math.abs(financial - pilot.impact.financialValueZar) > 1) {
    errors.push(`financial mismatch: expected ${financial}, got ${pilot.impact.financialValueZar}`);
  }
  const carbon =
    (pilot.impact.recoveredOrRecoverableMWh * 1000 * pilot.impact.emissionsFactorKgPerKwh) / 1000;
  if (Math.abs(carbon - pilot.impact.avoidedCo2t) > 0.05) {
    errors.push(`carbon mismatch: expected ${carbon}, got ${pilot.impact.avoidedCo2t}`);
  }
  if (pilot.frozenVersion !== FROZEN_DEMO_PACK_VERSION) {
    errors.push(`frozen version mismatch: ${pilot.frozenVersion} vs ${FROZEN_DEMO_PACK_VERSION}`);
  }
  return errors;
}
