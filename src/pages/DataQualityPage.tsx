import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { Breadcrumbs } from '../components/Breadcrumbs';
import {
  createDataQualityException,
  fetchOperatingMode,
  fetchDashboardSummary,
  listDataQualityExceptions,
  updateDataQualityException,
  type DataQualityExceptionDto
} from '../services/api';
import { useToast } from '../components/Toast';
import { DataStateBanner } from '../components/DataFetchState';
import { useAuth } from '../context/AuthContext';

const TYPES = [
  'missing_readings',
  'stale_data',
  'timestamp_error',
  'invalid_units',
  'out_of_range',
  'duplicate_readings',
  'sensor_drift',
  'communication_gap'
] as const;

export function DataQualityPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [issues, setIssues] = useState<DataQualityExceptionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modeLabel, setModeLabel] = useState('—');
  const [env, setEnv] = useState('—');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    exceptionType: 'stale_data',
    title: '',
    detail: '',
    provenance: 'measured',
    quality: 'uncertain'
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, mode, summary] = await Promise.all([
        listDataQualityExceptions({ bootstrap: true }),
        fetchOperatingMode().catch(() => null),
        fetchDashboardSummary().catch(() => null)
      ]);
      setIssues(rows);
      if (mode) setModeLabel(mode.label);
      if (summary?.telemetryEnvironment) setEnv(summary.telemetryEnvironment);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load data quality');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const resolve = async (issue: DataQualityExceptionDto, status: 'resolved' | 'approved' | 'quarantined') => {
    const resolutionNotes =
      window.prompt(status === 'quarantined' ? 'Quarantine reason' : 'Resolution / approval notes') ||
      `${status} by ${user?.name ?? 'operator'}`;
    setBusy(true);
    try {
      await updateDataQualityException(issue.id, {
        status,
        resolutionNotes,
        approvedByName: status === 'approved' ? user?.name ?? 'operator' : undefined
      });
      showToast(`Exception ${status}`, 'success');
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Update failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await createDataQualityException(form);
      setForm((f) => ({ ...f, title: '', detail: '' }));
      showToast('Exception opened', 'success');
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Create failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 pb-20">
      <PageHeader
        title="Data quality exceptions"
        description="Missing, stale, timestamp, units, range, duplicates, drift, and communication gaps — with resolution history"
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Administration', onClick: () => navigate('/') },
              { label: 'Data quality' }
            ]}
          />
        }
      />

      <div className="grid gap-3 rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-sm text-slate-300 sm:grid-cols-2">
        <div>Operating mode: {modeLabel}</div>
        <div>Telemetry environment: {env}</div>
      </div>

      <form
        className="grid max-w-2xl gap-3 rounded-xl border border-slate-800 bg-slate-900/50 p-4 sm:grid-cols-2"
        onSubmit={(e) => void create(e)}>
        <label className="block text-sm text-slate-400">
          Exception type
          <select
            className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
            value={form.exceptionType}
            onChange={(e) => setForm((f) => ({ ...f, exceptionType: e.target.value }))}>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm text-slate-400">
          Quality
          <select
            className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
            value={form.quality}
            onChange={(e) => setForm((f) => ({ ...f, quality: e.target.value }))}>
            {['good', 'uncertain', 'stale', 'bad'].map((q) => (
              <option key={q} value={q}>
                {q}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm text-slate-400 sm:col-span-2">
          Title
          <input
            className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            required
          />
        </label>
        <label className="block text-sm text-slate-400 sm:col-span-2">
          Detail
          <textarea
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
            rows={2}
            value={form.detail}
            onChange={(e) => setForm((f) => ({ ...f, detail: e.target.value }))}
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="min-h-11 w-fit rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 disabled:opacity-50 sm:col-span-2">
          Open exception
        </button>
      </form>

      <DataStateBanner
        loading={loading}
        error={error}
        empty={!loading && !error && issues.length === 0}
        emptyMessage="No exceptions."
        tone="operations"
        onRetry={() => void load()}
      />

      <ul className="space-y-3">
        {issues.map((issue) => (
          <li key={issue.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-slate-100">{issue.title}</p>
                <p className="text-xs text-slate-500">
                  {issue.exceptionType} · provenance{' '}
                  <span className="uppercase text-amber-200">{issue.provenance}</span> · quality{' '}
                  {issue.quality} · {issue.status}
                </p>
                {issue.detail ? <p className="mt-1 text-sm text-slate-400">{issue.detail}</p> : null}
                {issue.history?.length ? (
                  <details className="mt-2 text-xs text-slate-500">
                    <summary>Resolution history ({issue.history.length})</summary>
                    <ul className="mt-1 space-y-1">
                      {issue.history.map((h, idx) => (
                        <li key={`${issue.id}-${idx}`}>
                          {new Date(h.at).toLocaleString()} · {h.actor} · {h.status} — {h.note}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {issue.status === 'open' && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void resolve(issue, 'quarantined')}
                    className="min-h-10 rounded-lg border border-amber-700/40 px-3 py-1.5 text-xs text-amber-200">
                    Quarantine
                  </button>
                )}
                {issue.status !== 'resolved' && issue.status !== 'approved' && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void resolve(issue, 'resolved')}
                    className="min-h-10 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200">
                    Resolve
                  </button>
                )}
                {issue.status === 'resolved' && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void resolve(issue, 'approved')}
                    className="min-h-10 rounded-lg bg-emerald-500/90 px-3 py-1.5 text-xs font-medium text-slate-950">
                    Approve
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
