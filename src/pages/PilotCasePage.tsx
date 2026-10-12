import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileDown, CheckCircle2 } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { ProvenanceBadge } from '../components/ProvenanceBadge';
import { FROZEN_DEMO_PACK_VERSION, FROZEN_RETROSPECTIVE_PILOT } from '../lib/pilotCase';
import { openVerifiedPilotReport } from '../lib/verifiedPilotReport';
import { loadOfflineDemoPack } from '../lib/offlineDemoPack';

export function PilotCasePage() {
  const navigate = useNavigate();
  const pilot = FROZEN_RETROSPECTIVE_PILOT;
  const offline = loadOfflineDemoPack();

  const rows: Array<{ label: string; value: string; kind?: React.ComponentProps<typeof ProvenanceBadge>['kind'] }> = [
    { label: 'Site', value: `${pilot.site.name} · ${pilot.site.region}` },
    { label: 'Installed capacity', value: `${pilot.site.installedCapacityMWp} MWp · ${pilot.site.technology}` },
    {
      label: 'Monitoring period',
      value: `${pilot.monitoring.start} → ${pilot.monitoring.end} (${pilot.monitoring.days} days)`
    },
    {
      label: 'Actual generation',
      value: `${pilot.generation.actualMWh.toLocaleString()} MWh`,
      kind: pilot.generation.actualClass
    },
    {
      label: 'Expected generation',
      value: `${pilot.generation.expectedMWh.toLocaleString()} MWh`,
      kind: pilot.generation.expectedClass
    },
    { label: 'Identified loss', value: `${pilot.loss.identifiedMWh.toLocaleString()} MWh` },
    { label: 'Cause of the loss', value: pilot.loss.causeLabel, kind: pilot.loss.causeClass },
    { label: 'Recommendation', value: pilot.recommendation.summary },
    { label: 'Action taken', value: pilot.action.taken },
    {
      label: 'Energy recovered / recoverable',
      value: `${pilot.impact.recoveredOrRecoverableMWh.toLocaleString()} MWh`,
      kind: pilot.impact.impactClass
    },
    {
      label: 'Estimated financial value',
      value: `R ${pilot.impact.financialValueZar.toLocaleString()}`,
      kind: pilot.impact.financialClass
    },
    {
      label: 'Avoided CO₂',
      value: `${pilot.impact.avoidedCo2t.toLocaleString()} tCO₂e`,
      kind: pilot.impact.carbonClass
    }
  ];

  return (
    <div className="gf-page gf-projector-text">
      <PageHeader
        title="Pilot case evidence"
        description={`Frozen pack ${FROZEN_DEMO_PACK_VERSION} — synthetic retrospective site, labelled impact classes, internal reviewer only`}
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Presentation', onClick: () => navigate('/gcip') },
              { label: 'Pilot case' }
            ]}
          />
        }
      />

      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-50 sm:text-base">
        <strong>{pilot.modeLabel}</strong>
        <p className="mt-1 text-amber-100/90">
          Real physical intervention is not claimed. This pack uses a validated historical dataset and never presents
          invented savings as achieved results.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800">
        <table className="min-w-full text-left text-sm text-slate-200 sm:text-base">
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-t border-slate-800 odd:bg-slate-900/40">
                <th className="w-[34%] px-4 py-3 align-top font-medium text-slate-400">{row.label}</th>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-start gap-2">
                    <span>{row.value}</span>
                    {row.kind ? <ProvenanceBadge kind={row.kind} /> : null}
                  </div>
                </td>
              </tr>
            ))}
            <tr className="border-t border-slate-800 bg-emerald-500/5">
              <th className="px-4 py-3 align-top font-medium text-slate-400">Reviewer confirmation</th>
              <td className="px-4 py-3">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                  <div>
                    <p className="font-medium text-slate-100">
                      {pilot.reviewer.name} — {pilot.reviewer.role}
                    </p>
                    <p className="mt-1 text-slate-300">{pilot.reviewer.confirmation}</p>
                    <p className="mt-1 text-xs text-slate-500">Confirmed {pilot.reviewer.confirmedAt}</p>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => openVerifiedPilotReport(pilot)}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 sm:text-base">
          <FileDown className="h-4 w-4" />
          Open verified pilot PDF
        </button>
        <button
          type="button"
          onClick={() => navigate('/climate-impact')}
          className="min-h-11 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 sm:text-base">
          Climate-impact calculator
        </button>
        <button
          type="button"
          onClick={() => navigate('/commercial-value')}
          className="min-h-11 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 sm:text-base">
          Commercial dashboard
        </button>
        <button
          type="button"
          onClick={() => navigate('/ai-evidence')}
          className="min-h-11 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 sm:text-base">
          Evidence behind the AI
        </button>
      </div>

      <details className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-sm text-slate-400">
        <summary className="cursor-pointer font-medium text-slate-200">Offline demonstration fallback</summary>
        <p className="mt-2">{offline.label}</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {offline.talkingPoints.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
