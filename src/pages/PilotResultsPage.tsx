import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { persistDecision } from '../lib/decisionLog';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';

export function PilotResultsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [predicted, setPredicted] = useState('1875.94');
  const [realised, setRealised] = useState('');
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);

  const approveImpact = async () => {
    if (!realised.trim()) {
      showToast('Enter realised measured impact before verification', 'error');
      return;
    }
    setBusy(true);
    try {
      await persistDecision({
        entityType: 'recovery_case',
        entityId: 'pilot-verified-impact',
        title: 'Verified pilot impact approval',
        stage: 'verified',
        actorName: user?.name ?? 'Operator',
        actorRole: user?.role ?? 'operator',
        reason: `Approved verified impact: predicted R ${predicted} vs realised R ${realised}`,
        expectedOutcome: 'Never claim synthetic demo numbers as customer savings',
        previousState: 'pending_verification',
        newState: 'verified',
        conditions: 'Measured telemetry only; synthetic rows excluded'
      });
      setVerified(true);
      showToast('Verified impact recorded in audit trail', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Verification failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 p-6 pb-20">
      <PageHeader
        title="Pilot results and verified impact"
        description="Compare predicted advisory savings with realised measured outcomes"
        breadcrumbs={
          <Breadcrumbs items={[{ label: 'Overview', onClick: () => navigate('/') }, { label: 'Verified impact' }]} />
        }
      />

      <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
        Synthetic demonstration figures must never be labelled as customer results. Enter realised values only from
        measured telemetry.
      </p>

      <div className="grid max-w-xl gap-4 rounded-xl border border-slate-800 bg-slate-900/50 p-5">
        <label className="block text-sm text-slate-400">
          Predicted advisory savings (ZAR) — illustrative
          <input
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-200"
            value={predicted}
            onChange={(e) => setPredicted(e.target.value)}
          />
        </label>
        <label className="block text-sm text-slate-400">
          Realised measured impact (ZAR)
          <input
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-200"
            value={realised}
            onChange={(e) => setRealised(e.target.value)}
            placeholder="Measured only"
          />
        </label>
        <button
          type="button"
          disabled={busy || verified}
          onClick={() => void approveImpact()}
          className="w-fit rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 disabled:opacity-50">
          {verified ? 'Verified' : 'Approve verified impact'}
        </button>
        <button
          type="button"
          onClick={() => navigate('/reports')}
          className="w-fit text-sm text-emerald-400 hover:text-emerald-300">
          Open report centre
        </button>
      </div>
    </div>
  );
}
