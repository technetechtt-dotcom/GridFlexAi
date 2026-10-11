import React, { useEffect, useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { fetchOptimisationRuns, type OptimisationRunSummary } from '../services/api';
import { PageHeader } from '../components/PageHeader';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { DataStateBanner } from '../components/DataFetchState';
import { useAuth } from '../context/AuthContext';
import { recordDecision } from '../lib/decisionLog';
import { useToast } from '../components/Toast';

export function ApprovalQueuePage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [runs, setRuns] = useState<OptimisationRunSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [localStatus, setLocalStatus] = useState<Record<string, 'approved' | 'rejected'>>({});

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const rows = await fetchOptimisationRuns();
        if (!active) return;
        setRuns(rows.filter((r) => r.advisory || r.status !== 'executed'));
        setError(null);
      } catch (err) {
        if (!active) return;
        setRuns([]);
        setError(err instanceof Error ? err.message : 'Unable to load optimisation runs.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const decide = (run: OptimisationRunSummary, decision: 'approved' | 'rejected') => {
    setLocalStatus((prev) => ({ ...prev, [run.id]: decision }));
    recordDecision({
      entityType: 'optimisation',
      entityId: run.id,
      title: `Optimisation ${run.plantId}`,
      stage: decision,
      actorName: user?.name ?? 'Operator',
      actorRole: user?.role ?? 'operator',
      reason: `${decision} advisory optimisation run`,
      expectedOutcome:
        decision === 'approved'
          ? `Advisory benefit R ${run.expectedBenefitZar?.toFixed(2) ?? 'n/a'} — no plant command`
          : 'Rejected; no schedule proposed'
    });
    showToast(
      decision === 'approved'
        ? 'Advisory run approved (intent only — execution locked)'
        : 'Advisory run rejected',
      decision === 'approved' ? 'success' : 'info'
    );
  };

  return (
    <div className="space-y-6 p-6 pb-20">
      <PageHeader
        title="Dispatch approval queue"
        description="Advisory optimisation proposals awaiting human review"
        breadcrumbs={
          <Breadcrumbs items={[{ label: 'Overview', onClick: () => window.location.assign('/') }, { label: 'Approvals' }]} />
        }
      />

      <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
        Approving items records intent only — physical plant execution stays locked in pilot mode.
      </p>

      <DataStateBanner
        loading={loading}
        error={error}
        empty={!loading && !error && runs.length === 0}
        emptyMessage="No pending advisory runs in the queue."
        tone="operations"
        onRetry={() => window.location.reload()}
      />

      <ul className="space-y-3">
        {runs.map((run) => {
          const decision = localStatus[run.id];
          return (
            <li key={run.id} className="flex flex-wrap gap-3 rounded-lg border border-slate-800 bg-slate-900/50 p-4">
              <ClipboardCheck className="h-5 w-5 shrink-0 text-emerald-400" />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-100">{run.plantId}</p>
                <p className="text-sm text-slate-400">
                  {decision ?? run.status} · {run.advisoryLabel ?? 'advisory'} · solver {run.solverVersion}
                </p>
                {run.expectedBenefitZar != null && (
                  <p className="text-xs text-emerald-400">Expected benefit R {run.expectedBenefitZar.toFixed(2)}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!decision ? (
                  <>
                    <button
                      type="button"
                      onClick={() => decide(run, 'rejected')}
                      className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800">
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => decide(run, 'approved')}
                      className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-medium text-slate-950 hover:bg-emerald-400">
                      Approve
                    </button>
                  </>
                ) : (
                  <span className="text-xs capitalize text-slate-400">{decision}</span>
                )}
                <span className="text-xs text-slate-500">{new Date(run.createdAt).toLocaleDateString()}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
