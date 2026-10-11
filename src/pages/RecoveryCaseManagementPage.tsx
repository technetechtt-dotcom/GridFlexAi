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
import { persistDecision } from '../lib/decisionLog';
import { useToast } from '../components/Toast';

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
  const { user } = useAuth();
  const { showToast } = useToast();
  const actor = user?.name ?? 'Operator';
  const [tick, setTick] = useState(0);
  const cases = useMemo(() => {
    void tick;
    return listRecoveryCases();
  }, [tick]);

  const refresh = () => setTick((v) => v + 1);

  const createCase = async () => {
    const created = createRecoveryCase({
      title: `Northern Cape recovery case ${new Date().toLocaleDateString()}`,
      plantLabel: 'Upington PV (demo)',
      owner: actor,
      engineeringReviewer: null,
      predictedSavingsZar: 1875.94
    });
    await persistDecision({
      entityType: 'recovery_case',
      entityId: created.id,
      title: created.title,
      stage: 'recovery_case_updated',
      actorName: actor,
      actorRole: user?.role ?? 'operator',
      reason: `Created ${created.caseNumber}`,
      expectedOutcome: 'Track advisory recovery through verification and closure'
    });
    showToast(`${created.caseNumber} created`, 'success');
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
        description="Case numbers, owners, engineering reviewers, evidence, options, realisation, verification, and closure"
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
          onClick: () => void createCase(),
          icon: FolderKanban,
          variant: 'primary'
        }}
      />

      <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
        Cases sync decisions to the audit API when online. They do not dispatch plant commands. Predicted savings from
        synthetic demos are illustrative until verified with measured data.
      </p>

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
                    value={row.engineeringReviewer ?? ''}
                    onChange={(e) => {
                      advanceRecoveryCase(
                        row.id,
                        { engineeringReviewer: e.target.value, status: 'pending_engineering' },
                        actor,
                        `Engineering reviewer → ${e.target.value || 'unassigned'}`
                      );
                      refresh();
                    }}
                  />
                </label>
                <label className="block text-xs text-slate-500">
                  Implementation date
                  <input
                    type="date"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                    value={row.implementationDate ?? ''}
                    onChange={(e) => {
                      advanceRecoveryCase(
                        row.id,
                        { implementationDate: e.target.value || null, status: 'implementing' },
                        actor,
                        `Implementation date set to ${e.target.value || 'none'}`
                      );
                      refresh();
                    }}
                  />
                </label>
                <label className="block text-xs text-slate-500">
                  Actual recovered energy (kWh)
                  <input
                    type="number"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                    value={row.actualRecoveredEnergyKwh ?? ''}
                    onChange={(e) => {
                      const value = e.target.value === '' ? null : Number(e.target.value);
                      advanceRecoveryCase(
                        row.id,
                        { actualRecoveredEnergyKwh: value },
                        actor,
                        `Recovered energy → ${value ?? 'n/a'} kWh`
                      );
                      refresh();
                    }}
                  />
                </label>
                <label className="block text-xs text-slate-500">
                  Realised revenue (ZAR)
                  <input
                    type="number"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                    value={row.realisedSavingsZar ?? ''}
                    onChange={(e) => {
                      const value = e.target.value === '' ? null : Number(e.target.value);
                      advanceRecoveryCase(
                        row.id,
                        { realisedSavingsZar: value, realisationRevenueZar: value },
                        actor,
                        `Realised revenue → R ${value ?? 'n/a'}`
                      );
                      refresh();
                    }}
                  />
                </label>
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

              <label className="block text-xs text-slate-500">
                Evidence attachment labels (comma-separated)
                <input
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                  value={row.evidenceAttachments.join(', ')}
                  placeholder="e.g. ppc-log.csv, inverter-trend.png"
                  onChange={(e) => {
                    const attachments = e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean);
                    advanceRecoveryCase(
                      row.id,
                      { evidenceAttachments: attachments, status: 'evidence_attached' },
                      actor,
                      `Evidence attachments: ${attachments.join(', ') || 'none'}`
                    );
                    refresh();
                  }}
                />
              </label>

              <label className="block text-xs text-slate-500">
                Verification / closure notes
                <textarea
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                  rows={2}
                  value={row.verificationNotes}
                  onChange={(e) => {
                    advanceRecoveryCase(row.id, { verificationNotes: e.target.value }, actor, 'Verification notes updated');
                    refresh();
                  }}
                />
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:border-emerald-500/40"
                  onClick={() => {
                    advanceRecoveryCase(row.id, { owner: actor, status: 'assigned' }, actor, `Assigned to ${actor}`);
                    void persistDecision({
                      entityType: 'recovery_case',
                      entityId: row.id,
                      title: row.title,
                      stage: 'assigned',
                      actorName: actor,
                      actorRole: user?.role ?? 'operator',
                      reason: `Assigned owner ${actor}`,
                      expectedOutcome: 'Owner drives case to verification'
                    });
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
                        nxt === 'verified' || nxt === 'closed'
                          ? row.realisedSavingsZar ?? (row.predictedSavingsZar ?? 0) * 0.72
                          : row.realisedSavingsZar;
                      const closedAt = nxt === 'closed' ? new Date().toISOString() : row.closedAt;
                      advanceRecoveryCase(
                        row.id,
                        {
                          status: nxt,
                          realisedSavingsZar: realised,
                          realisationRevenueZar: realised,
                          closedAt,
                          actualRecoveredEnergyKwh:
                            row.actualRecoveredEnergyKwh ??
                            (nxt === 'verified' || nxt === 'closed' ? 42.5 : null)
                        },
                        actor,
                        `Advanced to ${nxt}`
                      );
                      void persistDecision({
                        entityType: 'recovery_case',
                        entityId: row.id,
                        title: row.title,
                        stage: nxt === 'verified' || nxt === 'closed' ? 'verified' : 'recovery_case_updated',
                        actorName: actor,
                        actorRole: user?.role ?? 'operator',
                        reason: `Status → ${nxt}`,
                        expectedOutcome:
                          nxt === 'closed'
                            ? 'Case closed with realised energy/revenue recorded'
                            : `Move case toward ${nxt}`
                      });
                      refresh();
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
        {!cases.length && (
          <li className="rounded-xl border border-dashed border-slate-700 p-6 text-sm text-slate-500">
            No recovery cases yet. Create one to start operator case management.
          </li>
        )}
      </ul>
    </div>
  );
}
