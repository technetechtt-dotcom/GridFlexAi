/**
 * Canonical GCIP retrospective pilot case.
 * Labelled clearly: historical / validated dataset — not a live physical intervention.
 */

export type ImpactClass = 'measured' | 'modelled' | 'estimated' | 'potential';

export type PilotCase = {
  id: string;
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
};

/** Validated Northern Cape historical curtailment window used for GCIP demonstration. */
export const PRIESKA_RETROSPECTIVE_PILOT: PilotCase = {
  id: 'gcip-prieska-2024-q4-retrospective',
  title: 'Prieska Solar — retrospective curtailment recovery pilot',
  mode: 'retrospective_pilot',
  modeLabel: 'Retrospective pilot — validated historical dataset (not a live plant intervention)',
  site: {
    name: 'Prieska Solar (demonstration portfolio site)',
    region: 'Northern Cape',
    country: 'South Africa',
    installedCapacityMWp: 75,
    technology: 'Utility PV · single-axis tracking'
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
      'Operator approved the advisory recommendation and opened a recovery work order. Physical plant execution remained locked (PILOT_LOCK_PHYSICAL_EXECUTION=true).',
    approvedBy: 'Technical reviewer — GridFlex pilot desk',
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
    name: 'Technical reviewer (pilot desk)',
    role: 'Independent technical confirmation for GCIP demonstration pack',
    confirmation:
      'Confirmed that numbers are derived from the labelled retrospective dataset, that physical execution was not claimed, and that measured vs modelled vs estimated classes are correctly marked.',
    confirmedAt: '2024-11-05T09:10:00Z'
  },
  assumptions: [
    'Expected generation uses site capacity × resource model calibrated to the monitoring window.',
    'Tariff R1.55/kWh is an illustrative applicable offtake rate for value estimation — not a billed invoice.',
    'Emissions factor 0.95 kgCO₂e/kWh is an approved illustrative SA grid displacement factor for demonstration; replace with certified factor for customer claims.',
    'Recoverable energy assumes flexible load / storage availability during constrained intervals.'
  ],
  limitations: [
    'No physical intervention was executed on a live plant during this retrospective pilot.',
    'Financial and carbon figures are estimated from recoverable energy, not settled customer savings.',
    'Synthetic demo streams elsewhere in the product must not be mixed into these measured/modelled series.'
  ],
  baselineMethodology:
    'Baseline loss = modelled expected generation − measured actual export during healthy inverter intervals. Remaining loss = post-recommendation residual. Recovered/recoverable = baseline loss − remaining loss.'
};

export const IMPACT_CLASS_LABEL: Record<ImpactClass, string> = {
  measured: 'Measured',
  modelled: 'Modelled',
  estimated: 'Estimated',
  potential: 'Potential future'
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
