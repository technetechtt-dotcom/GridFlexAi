import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderKanban } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { useAuth } from '../context/AuthContext';
import {
  advanceRecoveryCase,
  createRecoveryCase,
  listRecoveryCases,
  type RecoveryCase,
  type RecoveryCaseStatus
} from '../lib/recoveryCases';
import { persistDecision } from '../lib/decisionLog';
import { useToast } from '../components/Toast';
import { DataStateBanner } from '../components/DataFetchState';

const STATUS_FLOW: RecoveryCaseStatus[] = [
  'draft',
  'assigned',
  'evidence_attached',
  'option_selected',
  'pending_engineering',
  'implementing',
  'completed',
  'verified',
  'closed'
];

export function RecoveryCaseManagementPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const actor = user?.name ?? 'Operator';
  const [cases, setCases] = useState<RecoveryCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listRecoveryCases();
      setCases(rows);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load recovery cases');
      setCases([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createCase = async () => {
    setBusy(true);
    try {
      const created = await createRecoveryCase({
        title: `Northern Cape recovery case ${new Date().toLocaleDateString()}`,
        plantLabel: 'Upington PV',
        owner: actor,
        engineeringReviewer: null,
        predictedSavingsZar: null
      });
      await persistDecision({
        entityType: 'recovery_case',
        entityId: created.id,
        title: created.title,
        stage: 'recovery_case_updated',
        actorName: actor,
        actorRole: user?.role ?? 'operator',
        reason: `Created ${created.caseNumber}`,
        expectedOutcome: 'Track recovery through verification and closure',
        newState: 'draft'
      });
      showToast(`${created.caseNumber} created in PostgreSQL`, 'success');
      await refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Create failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const nextStatus = (status: RecoveryCaseStatus): RecoveryCaseStatus | null => {
    const idx = STATUS_FLOW.indexOf(status);
    if (idx < 0 || idx >= STATUS_FLOW.length - 1) return null;
    return STATUS_FLOW[idx + 1] ?? null;
  };

  const patch = async (
    row: RecoveryCase,
    update: Parameters<typeof advanceRecoveryCase>[1],
    note: string,
    stage: 'assigned' | 'verified' | 'recovery_case_updated' = 'recovery_case_updated'
  ) => {
    setBusy(true);
    try {
      await advanceRecoveryCase(row.id, update, actor, note);
      await persistDecision({
        entityType: 'recovery_case',
        entityId: row.id,
        title: row.title,
        stage,
        actorName: actor,
        actorRole: user?.role ?? 'operator',
        reason: note,
        expectedOutcome: 'Server-backed recovery case update',
        previousState: row.status,
        newState: update.status ?? row.status,
        relatedRecoveryCaseId: row.id
      });
      await refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Update failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 p-6 pb-20">
      <PageHeader
        title="Recovery case management"
        description="PostgreSQL-backed cases with owners, reviewers, evidence, realisation, verification, and closure"
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Overview', onClick: () => navigate('/') },
              { label: 'Recovery cases' }
            ]}
          />
        }
        primaryAction={{
          label: busy ? 'Working…' : 'Create recovery case',
          onClick: () => void createCase(),
          icon: FolderKanban,
          variant: 'primary'
        }}
      />

      <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
        Cases and decisions are stored in PostgreSQL with audit logs. They do not dispatch plant commands. Predicted
        savings remain illustrative until verified with measured data.
      </p>

      <DataStateBanner
        loading={loading}
        error={error}
        empty={!loading && !error && cases.length === 0}
        emptyMessage="No recovery cases yet. Create one to start operator case management."
        tone="operations"
        onRetry={() => void refresh()}
      />

      <ul className="space-y-4">
        {cases.map((row) => {
          const nxt = nextStatus(row.status);
          return (
            <li key={row.id} className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-100">
                    {row.caseNumber} · {row.title}
                  </p>
                  <p className="text-sm text-slate-400">
                    {row.plantLabel} · Owner {row.owner}
                    {row.engineeringReviewer ? ` · Eng ${row.engineeringReviewer}` : ''} ·{' '}
                    {row.status.replace(/_/g, ' ')}
                  </p>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <div>Predicted R {row.predictedSavingsZar?.toFixed(2) ?? '—'}</div>
                  <div>Realised R {row.realisedSavingsZar?.toFixed(2) ?? '—'}</div>
                  <div>Recovered {row.actualRecoveredEnergyKwh?.toFixed(1) ?? '—'} kWh</div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="block text-xs text-slate-500">
                  Engineering reviewer
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                    defaultValue={row.engineeringReviewer ?? ''}
                    onBlur={(e) => {
                      if (e.target.value === (row.engineeringReviewer ?? '')) return;
                      void patch(
                        row,
                        { engineeringReviewer: e.target.value, status: 'pending_engineering' },
                        `Engineering reviewer → ${e.target.value || 'unassigned'}`
                      );
                    }}
                  />
                </label>
                <label className="block text-xs text-slate-500">
                  Implementation date
                  <input
                    type="date"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                    defaultValue={row.implementationDate ?? ''}
                    onBlur={(e) => {
                      if (e.target.value === (row.implementationDate ?? '')) return;
                      void patch(
                        row,
                        { implementationDate: e.target.value || null, status: 'implementing' },
                        `Implementation date set`
                      );
                    }}
                  />
                </label>
                <label className="block text-xs text-slate-500">
                  Actual recovered energy (kWh)
                  <input
                    type="number"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                    defaultValue={row.actualRecoveredEnergyKwh ?? ''}
                    onBlur={(e) => {
                      const value = e.target.value === '' ? null : Number(e.target.value);
                      void patch(row, { actualRecoveredEnergyKwh: value }, `Recovered energy → ${value ?? 'n/a'} kWh`);
                    }}
                  />
                </label>
                <label className="block text-xs text-slate-500">
                  Realised revenue (ZAR)
                  <input
                    type="number"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                    defaultValue={row.realisedSavingsZar ?? ''}
                    onBlur={(e) => {
                      const value = e.target.value === '' ? null : Number(e.target.value);
                      void patch(
                        row,
                        { realisedSavingsZar: value, realisationRevenueZar: value },
                        `Realised revenue → R ${value ?? 'n/a'}`
                      );
                    }}
                  />
                </label>
              </div>

              <label className="block text-xs text-slate-500">
                Evidence notes
                <textarea
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                  rows={2}
                  defaultValue={row.evidenceNotes}
                  onBlur={(e) => {
                    if (e.target.value === row.evidenceNotes) return;
                    void patch(
                      row,
                      { evidenceNotes: e.target.value, status: 'evidence_attached' },
                      'Evidence notes updated'
                    );
                  }}
                />
              </label>

              <label className="block text-xs text-slate-500">
                Evidence attachment labels (comma-separated)
                <input
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                  defaultValue={row.evidenceAttachments.join(', ')}
                  onBlur={(e) => {
                    const attachments = e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean);
                    void patch(
                      row,
                      { evidenceAttachments: attachments, status: 'evidence_attached' },
                      `Evidence attachments updated`
                    );
                  }}
                />
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:border-emerald-500/40 disabled:opacity-50"
                  onClick={() =>
                    void patch(row, { owner: actor, status: 'assigned' }, `Assigned to ${actor}`, 'assigned')
                  }>
                  Assign to me
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:border-emerald-500/40 disabled:opacity-50"
                  onClick={() =>
                    void patch(
                      row,
                      { selectedOption: 'Flexible load', status: 'option_selected' },
                      'Selected flexible load option'
                    )
                  }>
                  Select flexible load
                </button>
                {nxt && (
                  <button
                    type="button"
                    disabled={busy}
                    className="rounded-lg bg-emerald-500/90 px-3 py-1.5 text-xs font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
                    onClick={() => {
                      const closedAt = nxt === 'closed' ? new Date().toISOString() : row.closedAt;
                      void patch(
                        row,
                        { status: nxt, closedAt },
                        `Advanced to ${nxt}`,
                        nxt === 'verified' || nxt === 'closed' ? 'verified' : 'recovery_case_updated'
                      );
                    }}>
                    Advance to {nxt.replace(/_/g, ' ')}
                  </button>
                )}
              </div>

              <details className="text-xs text-slate-500">
                <summary className="cursor-pointer text-slate-400">Status history</summary>
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
      </ul>
    </div>
  );
}
