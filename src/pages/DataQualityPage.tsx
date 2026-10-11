import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { fetchOperatingMode, fetchDashboardSummary } from '../services/api';
import { persistDecision } from '../lib/decisionLog';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';

type Issue = {
  id: string;
  title: string;
  provenance: 'measured' | 'forecast' | 'simulated' | 'estimated';
  quality: 'good' | 'uncertain' | 'stale' | 'bad';
  status: 'open' | 'quarantined' | 'resolved';
};

const SEED: Issue[] = [
  {
    id: 'dq-1',
    title: 'Stale inverter telemetry > 15 min',
    provenance: 'measured',
    quality: 'stale',
    status: 'open'
  },
  {
    id: 'dq-2',
    title: 'Synthetic forecast stream labelled incorrectly',
    provenance: 'simulated',
    quality: 'uncertain',
    status: 'quarantined'
  },
  {
    id: 'dq-3',
    title: 'Clear-sky baseline used for comparison',
    provenance: 'estimated',
    quality: 'uncertain',
    status: 'open'
  }
];

export function DataQualityPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [issues, setIssues] = useState(SEED);
  const [modeLabel, setModeLabel] = useState('—');
  const [env, setEnv] = useState('—');

  useEffect(() => {
    void Promise.all([fetchOperatingMode().catch(() => null), fetchDashboardSummary().catch(() => null)]).then(
      ([mode, summary]) => {
        if (mode) setModeLabel(mode.label);
        if (summary?.telemetryEnvironment) setEnv(summary.telemetryEnvironment);
      }
    );
  }, []);

  const resolve = async (issue: Issue) => {
    setIssues((prev) => prev.map((row) => (row.id === issue.id ? { ...row, status: 'resolved' } : row)));
    await persistDecision({
      entityType: 'diagnostics',
      entityId: issue.id,
      title: issue.title,
      stage: 'completed',
      actorName: user?.name ?? 'Operator',
      actorRole: user?.role ?? 'operator',
      reason: `Resolved data-quality issue (${issue.provenance}/${issue.quality})`,
      expectedOutcome: 'Keep measured vs estimated streams visually distinct',
      previousState: issue.status,
      newState: 'resolved'
    });
    showToast('Issue resolved and audited', 'success');
  };

  return (
    <div className="space-y-6 p-6 pb-20">
      <PageHeader
        title="Data provenance and quality"
        description="Separate measured, forecast, simulated and estimated feeds; quarantine poor samples"
        breadcrumbs={
          <Breadcrumbs items={[{ label: 'Overview', onClick: () => navigate('/') }, { label: 'Data quality' }]} />
        }
      />
      <div className="grid gap-3 rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-sm text-slate-300 md:grid-cols-2">
        <div>Operating mode: {modeLabel}</div>
        <div>Telemetry environment: {env}</div>
      </div>
      <ul className="space-y-3">
        {issues.map((issue) => (
          <li key={issue.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium text-slate-100">{issue.title}</p>
                <p className="text-xs text-slate-500">
                  Provenance <span className="uppercase text-amber-200">{issue.provenance}</span> · quality{' '}
                  {issue.quality} · {issue.status}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/provider-diagnostics')}
                  className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200">
                  Open diagnostics
                </button>
                {issue.status !== 'resolved' && (
                  <button
                    type="button"
                    onClick={() => void resolve(issue)}
                    className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-medium text-slate-950">
                    Resolve
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
