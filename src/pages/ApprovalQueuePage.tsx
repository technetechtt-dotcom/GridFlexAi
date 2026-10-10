import React, { useEffect, useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { fetchOptimisationRuns, type OptimisationRunSummary } from '../services/api';
import { PageHeader } from '../components/PageHeader';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { DataStateBanner } from '../components/DataFetchState';

export function ApprovalQueuePage() {
  const [runs, setRuns] = useState<OptimisationRunSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        {runs.map((run) => (
          <li key={run.id} className="flex gap-3 rounded-lg border border-slate-800 bg-slate-900/50 p-4">
            <ClipboardCheck className="h-5 w-5 shrink-0 text-emerald-400" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-slate-100">{run.plantId}</p>
              <p className="text-sm text-slate-400">
                {run.status} · {run.advisoryLabel ?? 'advisory'} · solver {run.solverVersion}
              </p>
              {run.expectedBenefitZar != null && (
                <p className="text-xs text-emerald-400">Expected benefit R {run.expectedBenefitZar.toFixed(2)}</p>
              )}
            </div>
            <span className="text-xs text-slate-500">{new Date(run.createdAt).toLocaleDateString()}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
