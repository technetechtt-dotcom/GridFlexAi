import { FROZEN_DEMO_PACK_VERSION, FROZEN_RETROSPECTIVE_PILOT, validateFrozenPilotCase } from './pilotCase';

/**
 * Offline demonstration fallback when API / Render is cold or unreachable.
 */
export const OFFLINE_DEMO_PACK = {
  generatedAt: '2024-11-05T09:10:00Z',
  frozenVersion: FROZEN_DEMO_PACK_VERSION,
  label: 'Offline demonstration pack — frozen synthetic retrospective pilot evidence',
  pilot: FROZEN_RETROSPECTIVE_PILOT,
  talkingPoints: [
    'One synthetic Northern Cape–style solar site, 75 MWp, October 2024 monitoring window.',
    'Measured actual generation vs modelled expected generation (demonstration classes).',
    'Loss attributed to grid export constraint, not equipment failure.',
    'Advisory recommendation approved by internal GridFlex pilot desk; physical execution locked.',
    'Recoverable energy, financial value and CO₂ are labelled Potential / Estimated.',
    'Commercial model: edge install + monthly subscription + optional performance fee.',
    'No real commercial plant brand is claimed.'
  ],
  aiEvidence: {
    forecastMethod: 'Hybrid clear-sky + weather-informed expected generation, compared to measured AC export.',
    curtailmentVsFailure:
      'Healthy inverter status + healthy irradiance + export below expected ⇒ curtailment. Fault codes / zero current with irradiance ⇒ equipment path.',
    confidenceThreshold: 0.65,
    humanLoop: 'Operator must approve or reject; low confidence creates a review task only.'
  }
} as const;

export function loadOfflineDemoPack() {
  const errors = validateFrozenPilotCase(OFFLINE_DEMO_PACK.pilot);
  if (errors.length) {
    console.warn('[offline-demo] frozen pack validation warnings:', errors);
  }
  return OFFLINE_DEMO_PACK;
}
