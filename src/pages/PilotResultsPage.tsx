import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileDown } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { persistDecision } from '../lib/decisionLog';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { PilotReportModal } from '../components/PilotReportModal';

type MetricRow = {
  id: string;
  label: string;
  value: string;
  classLabel: 'Measured' | 'Estimated' | 'Calculated' | 'Simulated';
  notes: string;
};

const DEFAULT_METRICS: MetricRow[] = [
  {
    id: 'energy',
    label: 'Verified energy savings',
    value: '',
    classLabel: 'Measured',
    notes: 'Enter only from metered export / generation deltas vs baseline'
  },
  {
    id: 'peak',
    label: 'Peak-demand reduction',
    value: '',
    classLabel: 'Measured',
    notes: 'kW peak reduction from billing interval data'
  },
  {
    id: 'curtailment',
    label: 'Avoided curtailment',
    value: '',
    classLabel: 'Calculated',
    notes: 'Recovered kWh from curtailment events with measured actuals'
  },
  {
    id: 'financial',
    label: 'Financial value (ZAR)',
    value: '',
    classLabel: 'Calculated',
    notes: 'Tariff-applied measured energy — not demo uplift'
  },
  {
    id: 'carbon',
    label: 'Carbon reduction (tCO₂e)',
    value: '',
    classLabel: 'Estimated',
    notes: 'Illustrative grid factor unless certified methodology attached'
  },
  {
    id: 'h2',
    label: 'Green-hydrogen opportunity (kg)',
    value: '',
    classLabel: 'Simulated',
    notes: 'Opportunity modelling only unless H₂ plant measured'
  },
  {
    id: 'completeness',
    label: 'Data completeness (%)',
    value: '',
    classLabel: 'Measured',
    notes: 'Share of expected telemetry intervals present'
  }
];

export function PilotResultsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [metrics, setMetrics] = useState(DEFAULT_METRICS);
  const [baselineMethod, setBaselineMethod] = useState(
    'Pre-pilot curtailment and demand intervals; clear-sky excluded from measured claims'
  );
  const [customerApproved, setCustomerApproved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const setMetric = (id: string, value: string) => {
    setMetrics((rows) => rows.map((row) => (row.id === id ? { ...row, value } : row)));
  };

  const approveImpact = async () => {
    const measuredMissing = metrics
      .filter((m) => m.classLabel === 'Measured' && !m.value.trim())
      .map((m) => m.label);
    if (measuredMissing.length) {
      showToast(`Enter measured values for: ${measuredMissing.join(', ')}`, 'error');
      return;
    }
    setBusy(true);
    try {
      await persistDecision({
        entityType: 'recovery_case',
        entityId: 'pilot-verified-impact',
        title: 'Customer pilot results approval',
        stage: 'verified',
        actorName: user?.name ?? 'Operator',
        actorRole: user?.role ?? 'operator',
        reason: `Approved pilot results. Baseline: ${baselineMethod}. Metrics: ${metrics
          .map((m) => `${m.label}=${m.value || 'n/a'} (${m.classLabel})`)
          .join('; ')}`,
        expectedOutcome: 'Separate measured vs estimated vs simulated claims',
        previousState: 'pending_verification',
        newState: 'verified',
        conditions: baselineMethod
      });
      setCustomerApproved(true);
      showToast('Customer approval recorded in PostgreSQL audit trail', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Verification failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 pb-20">
      <PageHeader
        title="Pilot results"
        description="Measured versus estimated outcomes with baseline methodology and customer approval"
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Analyse', onClick: () => navigate('/') },
              { label: 'Pilot results' }
            ]}
          />
        }
      />

      <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
        Simulated and estimated figures must never be labelled as verified customer savings. Measured rows require
        telemetry provenance.
      </p>

      <label className="block max-w-3xl text-sm text-slate-400">
        Baseline methodology
        <textarea
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-200"
          rows={2}
          value={baselineMethod}
          onChange={(e) => setBaselineMethod(e.target.value)}
        />
      </label>

      <div className="grid gap-3 md:grid-cols-2">
        {metrics.map((metric) => (
          <label
            key={metric.id}
            className="block rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-sm text-slate-400">
            <span className="font-medium text-slate-100">{metric.label}</span>
            <span className="ml-2 text-xs uppercase text-amber-200">{metric.classLabel}</span>
            <input
              className="mt-2 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-200"
              value={metric.value}
              onChange={(e) => setMetric(metric.id, e.target.value)}
              placeholder={metric.classLabel === 'Measured' ? 'Measured only' : 'Optional'}
            />
            <span className="mt-1 block text-xs text-slate-500">{metric.notes}</span>
          </label>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy || customerApproved}
          onClick={() => void approveImpact()}
          className="min-h-11 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 disabled:opacity-50">
          {customerApproved ? 'Customer approved' : 'Record customer approval'}
        </button>
        <button
          type="button"
          onClick={() => setReportOpen(true)}
          className="inline-flex min-h-11 items-center rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200">
          <FileDown className="mr-2 h-4 w-4" />
          Open GCIP pilot PDF export
        </button>
        <button
          type="button"
          onClick={() => navigate('/reports')}
          className="min-h-11 text-sm text-emerald-400 hover:text-emerald-300">
          Report centre
        </button>
      </div>

      <PilotReportModal isOpen={reportOpen} onClose={() => setReportOpen(false)} />
    </div>
  );
}
