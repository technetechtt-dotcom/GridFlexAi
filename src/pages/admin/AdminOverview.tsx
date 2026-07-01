import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  fetchAdminAuditLogs,
  fetchAdminOverview,
  runAdminClearForecastCache,
  runAdminTestNotification,
  type AdminAuditLog,
  type AdminPlatformOverview } from
'../../services/api';
import { useAdminRefresh } from './AdminLayout';

const POLL_MS = 15000;

const emptyOverview: AdminPlatformOverview = {
  generatedAt: new Date().toISOString(),
  database: { healthy: false },
  providers: {
    forecastSolar: 'open',
    openWeather: 'open',
    openWeatherConfigured: false,
    accuWeather: 'open',
    accuWeatherConfigured: false
  },
  overview: {
    usersTotal: 0,
    nodesTotal: 0,
    nodesOnline: 0,
    readings24h: 0
  },
  metrics: {
    totalRequests: 0,
    totalError4xx: 0,
    totalError5xx: 0,
    avgLatencyMs: 0,
    socketConnections: 0
  }
};

export function AdminOverview() {
  const { autoRefresh, refreshTick } = useAdminRefresh();
  const [data, setData] = useState<AdminPlatformOverview>(emptyOverview);
  const [latestQuickActions, setLatestQuickActions] = useState<AdminAuditLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<'cache' | 'notification' | null>(null);

  const load = useCallback(async () => {
    try {
      const [overview, logs] = await Promise.all([
        fetchAdminOverview(),
        fetchAdminAuditLogs({
          page: 1,
          pageSize: 25
        })
      ]);
      setData(overview);
      const quickActions = logs.data.
      filter((entry) =>
      entry.action === 'admin.quickAction.clearForecastCache' ||
      entry.action === 'admin.quickAction.testNotification'
      ).
      slice(0, 3);
      setLatestQuickActions(quickActions);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load admin overview.');
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

  return (
    <div className="space-y-4">
      {error && <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>}
      {actionMessage &&
      <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          {actionMessage}
        </div>
      }
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card title="Users" value={String(data.overview.usersTotal)} />
        <Card title="Nodes Online" value={`${data.overview.nodesOnline}/${data.overview.nodesTotal}`} />
        <Card title="Readings (24h)" value={String(data.overview.readings24h)} />
        <Card title="Avg API Latency" value={`${data.metrics.avgLatencyMs.toFixed(1)} ms`} />
      </div>
      <section className="rounded-xl border border-slate-700 bg-slate-900 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-100">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <button
            disabled={actionBusy !== null}
            onClick={() => {
              setActionBusy('cache');
              void runAdminClearForecastCache().
              then((result) => {
                setActionMessage(result.message);
              }).
              catch((loadError: unknown) => {
                setError(loadError instanceof Error ? loadError.message : 'Failed to clear forecast cache.');
              }).
              finally(() => {
                setActionBusy(null);
                void load();
              });
            }}
            className="rounded-lg bg-cyan-600 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-60">
            {actionBusy === 'cache' ? 'Clearing...' : 'Clear Forecast Cache'}
          </button>
          <button
            disabled={actionBusy !== null}
            onClick={() => {
              setActionBusy('notification');
              void runAdminTestNotification().
              then((result) => {
                setActionMessage(result.message);
              }).
              catch((loadError: unknown) => {
                setError(loadError instanceof Error ? loadError.message : 'Failed to run test notification.');
              }).
              finally(() => {
                setActionBusy(null);
                void load();
              });
            }}
            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60">
            {actionBusy === 'notification' ? 'Sending...' : 'Test Notification'}
          </button>
        </div>
      </section>
      <section className="rounded-xl border border-slate-700 bg-slate-900 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-100">Last Quick Action Results</h2>
          <Link
            to="/ops/logs"
            className="text-xs font-medium text-cyan-300 hover:text-cyan-200">
            View all logs
          </Link>
        </div>
        <div className="space-y-2">
          {latestQuickActions.length === 0 &&
          <p className="text-sm text-slate-500">No quick actions recorded yet.</p>
          }
          {latestQuickActions.map((entry) =>
          <div key={entry.id} className="rounded-lg border border-slate-700/80 bg-slate-950 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-slate-200">
                  {entry.action === 'admin.quickAction.clearForecastCache' ? 'Clear Forecast Cache' : 'Test Notification'}
                </p>
                <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                entry.action === 'admin.quickAction.clearForecastCache' ?
                'bg-cyan-500/20 text-cyan-200' :
                'bg-emerald-500/20 text-emerald-200'
                }`}>
                  {entry.action === 'admin.quickAction.clearForecastCache' ? 'cache' : 'notification'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">{entry.message ?? 'Action executed.'}</p>
              <p className="text-[11px] text-slate-500 mt-1">
                by {entry.userEmail ?? 'system'} at {new Date(entry.createdAt).toLocaleString()}
              </p>
            </div>
          )}
        </div>
      </section>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-700 bg-slate-900 p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-100">Platform Health</h2>
          <Row label="Database" value={data.database.healthy ? 'Healthy' : 'Unavailable'} />
          <Row label="Socket Connections" value={String(data.metrics.socketConnections)} />
          <Row label="Total Requests" value={String(data.metrics.totalRequests)} />
          <Row label="4xx Errors" value={String(data.metrics.totalError4xx)} />
          <Row label="5xx Errors" value={String(data.metrics.totalError5xx)} />
        </section>
        <section className="rounded-xl border border-slate-700 bg-slate-900 p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-100">Forecast Provider Health</h2>
          <Row label="Forecast.Solar" value={data.providers.forecastSolar} />
          <Row label="OpenWeather" value={`${data.providers.openWeather} (${data.providers.openWeatherConfigured ? 'configured' : 'missing key'})`} />
          <Row label="AccuWeather" value={`${data.providers.accuWeather} (${data.providers.accuWeatherConfigured ? 'configured' : 'missing key'})`} />
          <p className="mt-3 text-xs text-slate-500">Last update: {new Date(data.generatedAt).toLocaleString()}</p>
        </section>
      </div>
    </div>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-100">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-800 py-2 text-sm last:border-b-0">
      <span className="text-slate-400">{label}</span>
      <span className="text-slate-200">{value}</span>
    </div>
  );
}

