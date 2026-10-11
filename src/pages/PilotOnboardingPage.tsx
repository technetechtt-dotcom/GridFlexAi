import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Circle } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { persistDecision } from '../lib/decisionLog';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';

type Step = { id: string; title: string; detail: string; href: string };

const STEPS: Step[] = [
  { id: 'org', title: 'Organisation & site', detail: 'Confirm tenant records exist', href: '/plants' },
  { id: 'plant', title: 'Plant nameplate', detail: 'Register capacity and export limit', href: '/plants' },
  { id: 'edge', title: 'Edge credentials', detail: 'Provision vault-backed device credentials', href: '/nodes' },
  { id: 'telemetry', title: 'First telemetry packet', detail: 'Verify signed ingest and provenance', href: '/nodes' },
  { id: 'commission', title: 'Commissioning sign-off', detail: 'Approve advisory-only go-live; execution stays locked', href: '/approvals' }
];

const STORAGE_KEY = 'gridflex_pilot_onboarding_steps_v1';

export function PilotOnboardingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [done, setDone] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as string[];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(done));
  }, [done]);

  const toggle = async (step: Step) => {
    const next = done.includes(step.id) ? done.filter((id) => id !== step.id) : [...done, step.id];
    setDone(next);
    await persistDecision({
      entityType: 'diagnostics',
      entityId: `pilot-onboarding-${step.id}`,
      title: step.title,
      stage: 'completed',
      actorName: user?.name ?? 'Operator',
      actorRole: user?.role ?? 'operator',
      reason: next.includes(step.id) ? 'Marked onboarding step complete' : 'Reopened onboarding step',
      expectedOutcome: 'Track pilot commissioning without physical actuation',
      newState: next.includes(step.id) ? 'complete' : 'open'
    });
    showToast(`${step.title} updated`, 'success');
  };

  return (
    <div className="space-y-6 p-6 pb-20">
      <PageHeader
        title="Pilot onboarding"
        description="Organisation → site → plant → edge → telemetry → commissioning. Completion is audited."
        breadcrumbs={
          <Breadcrumbs items={[{ label: 'Overview', onClick: () => navigate('/') }, { label: 'Pilot onboarding' }]} />
        }
      />
      <ol className="space-y-3">
        {STEPS.map((step, index) => {
          const complete = done.includes(step.id);
          return (
            <li key={step.id} className="flex flex-wrap items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="mt-0.5 text-emerald-400">
                {complete ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5 text-slate-600" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-100">
                  {index + 1}. {step.title}
                </p>
                <p className="text-sm text-slate-400">{step.detail}</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => navigate(step.href)}
                  className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200">
                  Open
                </button>
                <button
                  type="button"
                  onClick={() => void toggle(step)}
                  className="rounded-lg bg-emerald-500/90 px-3 py-1.5 text-xs font-medium text-slate-950">
                  {complete ? 'Reopen' : 'Mark complete'}
                </button>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-slate-500">
        Step checkmarks are a local progress aid; each change writes a PostgreSQL operator decision / audit record.
      </p>
    </div>
  );
}
