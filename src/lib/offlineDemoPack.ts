import { PRIESKA_RETROSPECTIVE_PILOT } from './pilotCase';

/**
 * Offline demonstration fallback when API / Render is cold or unreachable.
 * Used by GCIP pages so judges still see a coherent story.
 */
export const OFFLINE_DEMO_PACK = {
  generatedAt: '2024-11-05T09:10:00Z',
  label: 'Offline demonstration pack — cached retrospective pilot evidence',
  pilot: PRIESKA_RETROSPECTIVE_PILOT,
  talkingPoints: [
    'One Northern Cape solar site, 75 MWp, October 2024 monitoring window.',
    'Measured actual generation vs modelled expected generation.',
    'Loss attributed to grid export constraint, not equipment failure.',
    'Advisory recommendation approved; physical execution remained locked.',
    'Recoverable energy, financial value and CO₂ are labelled Potential / Estimated.',
    'Commercial model: edge install + monthly subscription + optional performance fee.'
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
  return OFFLINE_DEMO_PACK;
}
