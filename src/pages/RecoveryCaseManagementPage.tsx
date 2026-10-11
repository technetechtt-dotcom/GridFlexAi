import React, { useMemo, useState } from 'react';
import { FolderKanban } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { useAuth } from '../context/AuthContext';
import {
  advanceRecoveryCase,
  createRecoveryCase,
  listRecoveryCases,
  type RecoveryCaseStatus
} from '../lib/recoveryCases';
import { recordDecision } from '../lib/decisionLog';

const STATUS_FLOW: RecoveryCaseStatus[] = [
  'draft',
  'assigned',
  'evidence_attached',
  'option_selected',
  'pending_engineering',
  'implementing',
  'completed',
  'verified'
];

export function RecoveryCaseManagementPage() {
  const { user } = useAuth();
  const actor = user?.name ?? 'Operator';
  const [tick, setTick] = useState(0);
  const cases = useMemo(() => {
    void tick;
    return listRecoveryCases();
  }, [tick]);

  const refresh = () => setTick((v) => v + 1);

  const createCase = () => {
    const created = createRecoveryCase({
      title: `Northern Cape recovery case ${new Date().toLocaleDateString()}`,
      plantLabel: 'Upington PV (demo)',
      owner: actor,
      predictedSavingsZar: 1875.94
    });
    recordDecision({
      entityType: 'recovery_case',
      entityId: created.id,
      title: created.title,
      stage: 'recovery_case_updated',
      actorName: actor,
      actorRole: user?.role ?? 'operator',
      reason: 'Created recovery case from management screen',
      expectedOutcome: 'Track advisory recovery through verification'
    });
    refresh();
  };

  const nextStatus = (status: RecoveryCaseStatus): RecoveryCaseStatus | null => {
    const idx = STATUS_FLOW.indexOf(status);
    if (idx < 0 || idx >= STATUS_FLOW.length - 1) return null;
    return STATUS_FLOW[idx + 1]!;
  };

  return (
    <div className="space-y-6 p-6 pb-20">
      <PageHeader
        title="Recovery case management"
        description="Assign owners, attach evidence notes, select options, and track realised vs predicted savings"
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Overview', onClick: () => window.location.assign('/') },
              { label: 'Recovery cases' }
            ]}
          />
        }
        primaryAction={{
          label: 'Create recovery case',
          onClick: createCase,
          icon: FolderKanban,
          variant: 'primary'
        }}
      />

      <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
        Cases are stored locally for the competition pilot UI. They do not dispatch plant commands.
        Predicted savings from synthetic demos are illustrative until verified with measured data.
      </p>

      <ul className="space-y-4">
        {cases.map((row) => {
          const nxt = nextStatus(row.status);
          return (
            <li key={row.id} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-100">{row.title}</p>
                  <p className="text-sm text-slate-400">
                    {row.plantLabel} · Owner {row.owner} · {row.status.replace(/_/g, ' ')}
                  </p>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <div>Predicted R {row.predictedSavingsZar?.toFixed(2) ?? '—'}</div>
                  <div>Realised R {row.realisedSavingsZar?.toFixed(2) ?? '—'}</div>
                </div>
              </div>

              <label className="block text-xs text-slate-500">
                Evidence notes
                <textarea
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                  rows={2}
                  value={row.evidenceNotes}
                  onChange={(e) => {
                    advanceRecoveryCase(
                      row.id,
                      { evidenceNotes: e.target.value, status: 'evidence_attached' },
                      actor,
                      'Evidence notes updated'
                    );
                    refresh();
                  }}
                />
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:border-emerald-500/40"
                  onClick={() => {
                    advanceRecoveryCase(
                      row.id,
                      { owner: actor, status: 'assigned' },
                      actor,
                      `Assigned to ${actor}`
                    );
                    refresh();
                  }}>
                  Assign to me
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:border-emerald-500/40"
                  onClick={() => {
                    advanceRecoveryCase(
                      row.id,
                      { selectedOption: 'Flexible load', status: 'option_selected' },
                      actor,
                      'Selected flexible load option'
                    );
                    refresh();
                  }}>
                  Select flexible load
                </button>
                {nxt && (
                  <button
                    type="button"
                    className="rounded-lg bg-emerald-500/90 px-3 py-1.5 text-xs font-medium text-slate-950 hover:bg-emerald-400"
                    onClick={() => {
                      const realised =
                        nxt === 'verified' ? (row.predictedSavingsZar ?? 0) * 0.72 : row.realisedSavingsZar;
                      advanceRecoveryCase(
                        row.id,
                        { status: nxt, realisedSavingsZar: realised },
                        actor,
                        `Advanced to ${nxt}`
                      );
                      recordDecision({
                        entityType: 'recovery_case',
                        entityId: row.id,
                        title: row.title,
                        stage: 'recovery_case_updated',
                        actorName: actor,
                        actorRole: user?.role ?? 'operator',
                        reason: `Status → ${nxt}`,
                        expectedOutcome:
                          nxt === 'verified'
                            ? 'Record realised vs predicted savings for pilot review'
                            : `Move case toward ${nxt}`
                      });
                      refresh();
                    }}>
                    Advance to {nxt.replace(/_/g, ' ')}
                  </button>
                )}
              </div>

              <details className="text-xs text-slate-500">
                <summary className="cursor-pointer text-slate-400">History</summary>
                <ul className="mt-2 space-y-1">
                  {row.history.map((h, idx) => (
                    <li key={`${h.at}-${idx}`}>
                      {new Date(h.at).toLocaleString()} · {h.actor}: {h.note} ({h.status})
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          );
        })}
        {!cases.length && (
          <li className="rounded-xl border border-dashed border-slate-700 p-6 text-sm text-slate-500">
            No recovery cases yet. Create one to start the advisory tracking workflow.
          </li>
        )}
      </ul>
    </div>
  );
}
