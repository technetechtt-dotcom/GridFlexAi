import React, { useMemo, useState } from 'react';
import { BrainCircuit, CheckCircle2 } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { useAuth } from '../context/AuthContext';
import { persistDecision, listDecisions } from '../lib/decisionLog';
import { useToast } from '../components/Toast';

type StepId =
  | 'dataset'
  | 'quality'
  | 'version'
  | 'evaluation'
  | 'approval'
  | 'deployment'
  | 'rollback'
  | 'audit';

const STEPS: Array<{ id: StepId; title: string; detail: string }> = [
  {
    id: 'dataset',
    title: 'Training dataset selection',
    detail: 'Choose measured Northern Cape windows; exclude synthetic simulation streams.'
  },
  {
    id: 'quality',
    title: 'Data-quality validation',
    detail: 'Gate on provenance quality, staleness, and missing intervals before training.'
  },
  {
    id: 'version',
    title: 'Model versioning',
    detail: 'Allocate candidate version (e.g. forecast-vNEXT) without replacing production.'
  },
  {
    id: 'evaluation',
    title: 'Offline evaluation',
    detail: 'Compare MAE/RMSE/MAPE vs current champion on hold-out measured data.'
  },
  {
    id: 'approval',
    title: 'Manager approval',
    detail: 'Human approval required before any deployment — no silent auto-promote.'
  },
  {
    id: 'deployment',
    title: 'Staged deployment',
    detail: 'Shadow-mode first; production advisory only after signed promote.'
  },
  {
    id: 'rollback',
    title: 'Rollback plan',
    detail: 'Document champion restore path and monitoring abort criteria.'
  },
  {
    id: 'audit',
    title: 'Audit history',
    detail: 'Every step writes an operator decision / audit record.'
  }
];

export function ModelReviewPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [dataset, setDataset] = useState('measured-nc-30d');
  const [candidateVersion, setCandidateVersion] = useState('forecast-v2026.10-candidate');
  const [completed, setCompleted] = useState<StepId[]>([]);
  const [tick, setTick] = useState(0);
  const actor = user?.name ?? 'Operator';

  const history = useMemo(() => {
    void tick;
    return listDecisions().filter((d) => d.entityType === 'model_review' || d.entityType === 'forecast');
  }, [tick]);

  const runStep = async (step: (typeof STEPS)[number]) => {
    if (completed.includes(step.id)) return;
    await persistDecision({
      entityType: 'model_review',
      entityId: candidateVersion,
      title: step.title,
      stage: step.id === 'approval' || step.id === 'deployment' ? 'model_review_requested' : 'model_review_requested',
      actorName: actor,
      actorRole: user?.role ?? 'operator',
      reason: `${step.title}: ${step.detail}`,
      expectedOutcome: `Advance controlled retrain workflow (${dataset})`,
      conditions: `Dataset=${dataset}; candidate=${candidateVersion}; physical execution locked`
    });
    setCompleted((prev) => [...prev, step.id]);
    setTick((v) => v + 1);
    showToast(`${step.title} recorded`, 'success');
  };

  const requestFullReview = async () => {
    for (const step of STEPS) {
      if (!completed.includes(step.id)) {
        await runStep(step);
      }
    }
    showToast('Full model-review workflow request audited — training does not start in-place', 'success');
  };

  return (
    <div className="space-y-6 p-6 pb-20">
      <PageHeader
        title="Model review workflow"
        description="Controlled dataset → quality → version → evaluate → approve → deploy → rollback → audit. Does not retrain in place."
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Overview', onClick: () => window.location.assign('/') },
              { label: 'Generation vs forecast', onClick: () => window.location.assign('/generation-vs-forecast') },
              { label: 'Model review' }
            ]}
          />
        }
        primaryAction={{
          label: 'Request full review',
          onClick: () => void requestFullReview(),
          icon: BrainCircuit,
          variant: 'primary'
        }}
      />

      <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
        This workflow records manager-gated review intent. It does not execute training jobs or replace the live model
        automatically.
      </p>

      <div className="grid max-w-2xl gap-4 rounded-xl border border-slate-800 bg-slate-900/50 p-5">
        <label className="block text-sm text-slate-400">
          Training dataset
          <select
            value={dataset}
            onChange={(e) => setDataset(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-200">
            <option value="measured-nc-30d">Measured Northern Cape — 30 days</option>
            <option value="measured-nc-90d">Measured Northern Cape — 90 days</option>
            <option value="measured-holdout">Hold-out measured only</option>
          </select>
        </label>
        <label className="block text-sm text-slate-400">
          Candidate model version
          <input
            value={candidateVersion}
            onChange={(e) => setCandidateVersion(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-200"
          />
        </label>
      </div>

      <ol className="space-y-3">
        {STEPS.map((step, index) => {
          const done = completed.includes(step.id);
          return (
            <li
              key={step.id}
              className="flex flex-wrap items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 text-sm text-slate-300">
                {done ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : index + 1}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-100">{step.title}</p>
                <p className="text-sm text-slate-400">{step.detail}</p>
              </div>
              <button
                type="button"
                disabled={done}
                onClick={() => void runStep(step)}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:border-emerald-500/40 disabled:opacity-40">
                {done ? 'Recorded' : 'Record step'}
              </button>
            </li>
          );
        })}
      </ol>

      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-200">Audit history (local + API)</h2>
        <ul className="max-h-56 space-y-1 overflow-y-auto text-xs text-slate-500">
          {history.slice(0, 40).map((h) => (
            <li key={h.id}>
              {new Date(h.createdAt).toLocaleString()} · {h.title} · {h.stage}
              {h.persisted ? ' · synced' : ' · local'}
            </li>
          ))}
          {!history.length && <li>No model-review decisions yet.</li>}
        </ul>
      </section>
    </div>
  );
}
