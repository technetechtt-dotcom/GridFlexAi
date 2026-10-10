import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { History, Recycle } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { listRecoveryAnalyses, type RecoveryAnalysisListItem } from '../services/api';

const zar = new Intl.NumberFormat('en-ZA', {
  style: 'currency',
  currency: 'ZAR',
  maximumFractionDigits: 0
});

export function RecoveryHistoryPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<RecoveryAnalysisListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await listRecoveryAnalyses({ limit: 50 });
        if (!cancelled) setRows(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load recovery history');
          setRows([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6 p-6 pb-20">
      <PageHeader
        title="Recovery history"
        description="Persisted curtailment recovery analyses — advisory only; physical execution remains locked."
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Overview', onClick: () => navigate('/') },
              { label: 'Recovery', onClick: () => navigate('/recovery') },
              { label: 'History' }
            ]}
          />
        }
        primaryAction={{
          label: 'New analysis',
          onClick: () => navigate('/recovery')
        }}
      />

      {loading && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-8 text-center text-slate-400">
          Loading recovery analyses…
        </div>
      )}

      {!loading && error && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          {error}
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-8 text-center">
          <History className="mx-auto h-10 w-10 text-slate-500" />
          <p className="mt-4 text-slate-300">No persisted recovery analyses yet</p>
          <p className="mt-2 text-sm text-slate-500">
            Run an analysis in Recovery Centre and persist it to see operator review history here.
          </p>
          <Link
            to="/recovery"
            className="mt-6 inline-flex items-center rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600">
            <Recycle className="mr-2 h-4 w-4" />
            Open Recovery Centre
          </Link>
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-900 text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Cause</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Loss</th>
                <th className="px-4 py-3 font-medium">Duration</th>
                <th className="px-4 py-3 font-medium">Revenue at risk</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-800 text-slate-200">
                  <td className="px-4 py-3 whitespace-nowrap">
                    {row.createdAt ? new Date(row.createdAt).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3">{row.dominantCause ?? '—'}</td>
                  <td className="px-4 py-3">{row.status ?? '—'}</td>
                  <td className="px-4 py-3">
                    {row.lostEnergyKwh != null ? `${row.lostEnergyKwh} kWh` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {row.affectedDurationHours != null ? `${row.affectedDurationHours} h` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {row.revenueAtRiskZar != null ? zar.format(row.revenueAtRiskZar) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
