import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Circle, Ban } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { listOnboardingSteps, updateOnboardingStep, type OnboardingStepDto } from '../services/api';
import { useToast } from '../components/useToast';
import { DataStateBanner } from '../components/DataFetchState';

const HREF: Record<string, string> = {
  organisation: '/plants',
  site: '/plants',
  plants_devices: '/plants',
  inverters: '/nodes',
  tariffs: '/settings',
  baseline: '/data-quality',
  telemetry_test: '/nodes',
  go_live: '/approvals',
  physical_lock: '/environment-release'
};

export function PilotOnboardingPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [steps, setSteps] = useState<OnboardingStepDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSteps(await listOnboardingSteps());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load onboarding');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setStatus = async (step: OnboardingStepDto, status: 'open' | 'complete' | 'blocked') => {
    setBusy(step.stepId);
    try {
      const notes =
        status === 'complete'
          ? window.prompt('Completion notes (audited)') || 'Marked complete'
          : status === 'blocked'
            ? window.prompt('Blocked reason') || 'Blocked'
            : 'Reopened';
      await updateOnboardingStep({ stepId: step.stepId, status, notes });
      showToast(`${step.title} → ${status}`, 'success');
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Update failed', 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 pb-20">
      <PageHeader
        title="Pilot onboarding"
        description="Organisation → site → plants/devices → inverters → tariffs → baseline → telemetry → go-live → physical-execution lock"
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Administration', onClick: () => navigate('/') },
              { label: 'Pilot onboarding' }
            ]}
          />
        }
      />

      <DataStateBanner
        loading={loading}
        error={error}
        empty={false}
        emptyMessage=""
        tone="operations"
        onRetry={() => void load()}
      />

      <ol className="space-y-3">
        {steps.map((step, index) => {
          const complete = step.status === 'complete';
          const blocked = step.status === 'blocked';
          return (
            <li
              key={step.stepId}
              className="flex flex-wrap items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="mt-0.5">
                {complete ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                ) : blocked ? (
                  <Ban className="h-5 w-5 text-amber-400" />
                ) : (
                  <Circle className="h-5 w-5 text-slate-600" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-100">
                  {index + 1}. {step.title}
                </p>
                <p className="text-sm text-slate-400">{step.detail}</p>
                {step.notes ? <p className="mt-1 text-xs text-slate-500">{step.notes}</p> : null}
                {step.updatedByName ? (
                  <p className="text-xs text-slate-600">Last update by {step.updatedByName}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => navigate(HREF[step.stepId] ?? '/plants')}
                  className="min-h-10 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200">
                  Open
                </button>
                <button
                  type="button"
                  disabled={busy === step.stepId}
                  onClick={() => void setStatus(step, complete ? 'open' : 'complete')}
                  className="min-h-10 rounded-lg bg-emerald-500/90 px-3 py-1.5 text-xs font-medium text-slate-950 disabled:opacity-50">
                  {complete ? 'Reopen' : 'Complete'}
                </button>
                {!complete && (
                  <button
                    type="button"
                    disabled={busy === step.stepId}
                    onClick={() => void setStatus(step, 'blocked')}
                    className="min-h-10 rounded-lg border border-amber-700/40 px-3 py-1.5 text-xs text-amber-200">
                    Block
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-slate-500">
        Progress is stored in PostgreSQL and each change writes an operator decision / audit record. Local browser
        checklists are not used.
      </p>
    </div>
  );
}
