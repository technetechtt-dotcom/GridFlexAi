import React, { useEffect, useState } from 'react';
import { ClipboardCheck, X } from 'lucide-react';
import {
  fetchOptimisationRun,
  fetchOptimisationRuns,
  listOperatorDecisions,
  type OptimisationRunDetail,
  type OptimisationRunSummary,
  type OperatorDecisionRecord
} from '../services/api';
import { PageHeader } from '../components/PageHeader';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { DataStateBanner } from '../components/DataFetchState';
import { useAuth } from '../context/AuthContext';
import { persistDecision } from '../lib/decisionLog';
import { useToast } from '../components/Toast';

type DecisionForm = {
  reason: string;
  assignedReviewer: string;
  conditions: string;
};

export function ApprovalQueuePage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [runs, setRuns] = useState<OptimisationRunSummary[]>([]);
  const [decisionsById, setDecisionsById] = useState<Record<string, OperatorDecisionRecord>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<OptimisationRunDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<DecisionForm>({
    reason: '',
    assignedReviewer: '',
    conditions: ''
  });

  const loadQueue = async () => {
    setLoading(true);
    try {
      const [rows, decisions] = await Promise.all([
        fetchOptimisationRuns(),
        listOperatorDecisions({ entityType: 'optimisation', limit: 200 })
      ]);
      setRuns(rows.filter((r) => r.advisory || r.status !== 'executed'));
      const latest: Record<string, OperatorDecisionRecord> = {};
      for (const d of decisions) {
        if (!d.entityId) continue;
        if (!latest[d.entityId]) latest[d.entityId] = d;
      }
      setDecisionsById(latest);
      setError(null);
    } catch (err) {
      setRuns([]);
      setError(err instanceof Error ? err.message : 'Unable to load optimisation runs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadQueue();
  }, []);

  const openProposal = async (run: OptimisationRunSummary) => {
    setSelectedId(run.id);
    setDetailLoading(true);
    setForm({
      reason: '',
      assignedReviewer: user?.name ?? '',
      conditions: 'Advisory only — no physical plant command'
    });
    try {
      const full = await fetchOptimisationRun(run.id);
      setDetail(full);
      await persistDecision({
        entityType: 'optimisation',
        entityId: run.id,
        title: `Opened proposal ${run.plantId}`,
        stage: 'proposal_opened',
        actorName: user?.name ?? 'Operator',
        actorRole: user?.role ?? 'operator',
        reason: 'Operator opened full advisory proposal',
        expectedOutcome: 'Review schedule before approve/reject'
      });
    } catch (err) {
      setDetail(null);
      showToast(err instanceof Error ? err.message : 'Unable to load proposal', 'error');
    } finally {
      setDetailLoading(false);
    }
  };

  const decide = async (decision: 'approved' | 'rejected') => {
    if (!selectedId || !detail) return;
    if (!form.reason.trim()) {
      showToast('Add a reason before recording the decision', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await persistDecision({
        entityType: 'optimisation',
        entityId: selectedId,
        title: `Optimisation ${detail.plant?.name ?? detail.plantId}`,
        stage: decision,
        actorName: user?.name ?? 'Operator',
        actorRole: user?.role ?? 'operator',
        reason: form.reason.trim(),
        assignedReviewer: form.assignedReviewer.trim() || undefined,
        conditions: form.conditions.trim() || undefined,
        expectedOutcome:
          decision === 'approved'
            ? `Advisory benefit R ${detail.expectedBenefitZar?.toFixed(2) ?? 'n/a'} — no plant command`
            : 'Rejected; no schedule proposed'
      });
      showToast(
        decision === 'approved'
          ? 'Advisory run approved and audited (intent only)'
          : 'Advisory run rejected and audited',
        decision === 'approved' ? 'success' : 'info'
      );
      setSelectedId(null);
      setDetail(null);
      await loadQueue();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Decision failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 p-6 pb-20">
      <PageHeader
        title="Dispatch approval queue"
        description="Open proposals, assign reviewers, record conditions, approve or reject with audit trail"
        breadcrumbs={
          <Breadcrumbs items={[{ label: 'Overview', onClick: () => window.location.assign('/') }, { label: 'Approvals' }]} />
        }
      />

      <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
        Approving items records intent and an audit record — physical plant execution stays locked in pilot mode.
      </p>

      <DataStateBanner
        loading={loading}
        error={error}
        empty={!loading && !error && runs.length === 0}
        emptyMessage="No pending advisory runs in the queue."
        tone="operations"
        onRetry={() => void loadQueue()}
      />

      <ul className="space-y-3">
        {runs.map((run) => {
          const decision = decisionsById[run.id];
          const label = decision?.decision ?? decision?.action?.replace('operator.decision.', '') ?? run.status;
          return (
            <li key={run.id} className="flex flex-wrap gap-3 rounded-lg border border-slate-800 bg-slate-900/50 p-4">
              <ClipboardCheck className="h-5 w-5 shrink-0 text-emerald-400" />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-100">{run.plantId}</p>
                <p className="text-sm text-slate-400">
                  {label} · {run.advisoryLabel ?? 'advisory'} · solver {run.solverVersion}
                </p>
                {run.expectedBenefitZar != null && (
                  <p className="text-xs text-emerald-400">Expected benefit R {run.expectedBenefitZar.toFixed(2)}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void openProposal(run)}
                  className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-medium text-slate-950 hover:bg-emerald-400">
                  Open proposal
                </button>
                <span className="text-xs text-slate-500">{new Date(run.createdAt).toLocaleDateString()}</span>
              </div>
            </li>
          );
        })}
      </ul>

      {selectedId && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/70 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">Advisory proposal</h2>
                <p className="text-sm text-slate-400">{detail?.plant?.name ?? selectedId}</p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => {
                  setSelectedId(null);
                  setDetail(null);
                }}
                className="rounded-lg border border-slate-700 p-1.5 text-slate-300 hover:bg-slate-800">
                <X className="h-4 w-4" />
              </button>
            </div>

            {detailLoading && <p className="text-sm text-slate-400">Loading proposal…</p>}
            {!detailLoading && detail && (
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3 rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-slate-300">
                  <div>Status: {detail.status}</div>
                  <div>Objective: {detail.objective ?? '—'}</div>
                  <div>Benefit: R {detail.expectedBenefitZar?.toFixed(2) ?? 'n/a'}</div>
                  <div>Schedules: {detail.schedules?.length ?? 0}</div>
                  <div className="col-span-2 text-xs text-emerald-300">
                    {detail.advisoryLabel ?? 'Advisory only'} · physicalControl={String(detail.physicalControl ?? false)}
                  </div>
                </div>

                {detail.schedules && detail.schedules.length > 0 && (
                  <div className="overflow-x-auto rounded-lg border border-slate-800">
                    <table className="min-w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-950 text-slate-400">
                        <tr>
                          <th className="px-2 py-1.5">Start</th>
                          <th className="px-2 py-1.5">Export kW</th>
                          <th className="px-2 py-1.5">BESS kW</th>
                          <th className="px-2 py-1.5">Electrolyser kW</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.schedules.slice(0, 12).map((row) => (
                          <tr key={row.id} className="border-t border-slate-800">
                            <td className="px-2 py-1.5">{new Date(row.intervalStart).toLocaleString()}</td>
                            <td className="px-2 py-1.5">{row.exportSetpointKw ?? '—'}</td>
                            <td className="px-2 py-1.5">{row.bessSetpointKw ?? '—'}</td>
                            <td className="px-2 py-1.5">{row.electrolyserSetpointKw ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <label className="block text-slate-400">
                  Assigned reviewer
                  <input
                    value={form.assignedReviewer}
                    onChange={(e) => setForm((f) => ({ ...f, assignedReviewer: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-200"
                  />
                </label>
                <label className="block text-slate-400">
                  Conditions
                  <textarea
                    value={form.conditions}
                    onChange={(e) => setForm((f) => ({ ...f, conditions: e.target.value }))}
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-200"
                  />
                </label>
                <label className="block text-slate-400">
                  Decision reason (required)
                  <textarea
                    value={form.reason}
                    onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-200"
                    placeholder="Why approve or reject this advisory proposal?"
                  />
                </label>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => void decide('rejected')}
                    className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50">
                    Reject
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => void decide('approved')}
                    className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-50">
                    Approve (advisory)
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
