import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { ProvenanceBadge } from '../components/ProvenanceBadge';
import { PRIESKA_RETROSPECTIVE_PILOT } from '../lib/pilotCase';
import { loadOfflineDemoPack } from '../lib/offlineDemoPack';

export function AiEvidencePage() {
  const navigate = useNavigate();
  const pilot = PRIESKA_RETROSPECTIVE_PILOT;
  const offline = loadOfflineDemoPack();

  return (
    <div className="gf-page gf-projector-text">
      <PageHeader
        title="Evidence behind the AI"
        description="What the model actually does — and what remains ordinary threshold rules"
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Presentation', onClick: () => navigate('/gcip') },
              { label: 'AI evidence' }
            ]}
          />
        }
      />

      <div className="rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/10 px-4 py-3 text-sm text-fuchsia-50 sm:text-base">
        Alarm thresholds and simple comparators are <strong>not</strong> presented as advanced AI. The AI / recovery
        path below is the decision-support layer: expected generation, loss attribution, confidence, and human approval.
      </div>

      <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/50 p-5">
        <h2 className="text-lg font-semibold text-slate-100 sm:text-xl">Inputs used</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300 sm:text-base">
          {pilot.recommendation.inputs.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
          <h2 className="text-lg font-semibold text-slate-100">Forecast method</h2>
          <p className="mt-2 text-sm text-slate-300 sm:text-base">{offline.aiEvidence.forecastMethod}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <ProvenanceBadge kind="modelled" />
            <ProvenanceBadge kind="measured" />
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
          <h2 className="text-lg font-semibold text-slate-100">Expected generation</h2>
          <p className="mt-2 text-sm text-slate-300 sm:text-base">
            Expected AC energy for the monitoring window is calculated from installed capacity, resource / clear-sky
            model, and plant availability. It is compared to measured export to quantify avoidable loss.
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
          <h2 className="text-lg font-semibold text-slate-100">Curtailment vs equipment failure</h2>
          <p className="mt-2 text-sm text-slate-300 sm:text-base">{offline.aiEvidence.curtailmentVsFailure}</p>
          <p className="mt-2 text-sm text-slate-400">
            This pilot case cause: <em>{pilot.loss.causeLabel}</em>
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
          <h2 className="text-lg font-semibold text-slate-100">Confidence</h2>
          <p className="mt-2 text-3xl font-semibold text-emerald-300">
            {(pilot.recommendation.confidence * 100).toFixed(0)}%
          </p>
          <p className="mt-2 text-sm text-slate-300 sm:text-base">
            Low-confidence threshold: {(offline.aiEvidence.confidenceThreshold * 100).toFixed(0)}%.{' '}
            {pilot.recommendation.lowConfidenceBehaviour}
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
        <h2 className="text-lg font-semibold text-slate-100">Why this recommendation was produced</h2>
        <p className="mt-2 text-sm text-slate-300 sm:text-base">{pilot.recommendation.why}</p>
        <p className="mt-3 text-sm text-slate-200 sm:text-base">
          Recommendation: {pilot.recommendation.summary}
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
          <h2 className="text-lg font-semibold text-slate-100">Operator approve / reject</h2>
          <p className="mt-2 text-sm text-slate-300 sm:text-base">{offline.aiEvidence.humanLoop}</p>
          <button
            type="button"
            onClick={() => navigate('/approvals')}
            className="mt-4 min-h-11 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200">
            Open approvals queue
          </button>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
          <h2 className="text-lg font-semibold text-slate-100">Learning loop</h2>
          <p className="mt-2 text-sm text-slate-300 sm:text-base">
            Approved and rejected decisions are stored in PostgreSQL with reason, prior/new state, actor role, model
            version and release SHA. Those outcomes feed future recommendation ranking — they are not discarded in the
            browser.
          </p>
          <button
            type="button"
            onClick={() => navigate('/recovery/cases')}
            className="mt-4 min-h-11 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200">
            Open recovery cases
          </button>
        </div>
      </section>
    </div>
  );
}
