import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { fetchAdminMetrics, type AdminMetricsSnapshot } from '../../services/api';
import { useAdminRefresh } from './AdminLayout';

const POLL_MS = 12000;

export function AdminMetricsPage() {
  const { autoRefresh, refreshTick } = useAdminRefresh();
  const [snapshot, setSnapshot] = useState<AdminMetricsSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const next = await fetchAdminMetrics();
      setSnapshot(next);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load platform metrics.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshTick]);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const timer = window.setInterval(() => {
      void load();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [autoRefresh, load]);

  const chartData = useMemo(() => {
    return (snapshot?.routes ?? []).slice(0, 10).map((route) => ({
      route: `${route.method} ${route.path}`.slice(0, 28),
      count: route.count,
      errors: route.error4xx + route.error5xx
    }));
  }, [snapshot]);

  return (
    <div className="space-y-4">
      {error && <div className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Total Requests" value={String(snapshot?.totalRequests ?? 0)} />
        <MetricCard label="Avg Latency" value={`${(snapshot?.avgLatencyMs ?? 0).toFixed(1)} ms`} />
        <MetricCard label="4xx Errors" value={String(snapshot?.totalError4xx ?? 0)} />
        <MetricCard label="5xx Errors" value={String(snapshot?.totalError5xx ?? 0)} />
        <MetricCard label="Sockets" value={String(snapshot?.socketConnections ?? 0)} />
      </div>
      <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-100">Route Load & Error Profile</h2>
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
              <XAxis dataKey="route" stroke="#94a3b8" tick={{ fontSize: 11 }} />
              <YAxis stroke="#94a3b8" />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={2} />
              <Line type="monotone" dataKey="errors" stroke="#ef4444" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-100">{value}</p>
    </div>
  );
}

