import React, { useCallback, useEffect, useState } from 'react';

import {
  acknowledgeAlarmEvent,
  fetchAlarmEvents,
  fetchIncidents,
  type AlarmCentreEvent,
  type AlarmCentreIncident
} from '../../services/api';
import { useAdminRefresh } from './AdminLayout';

const POLL_MS = 20000;

export function AdminAlarmsPage() {
  const { autoRefresh, refreshTick } = useAdminRefresh();
  const [events, setEvents] = useState<AlarmCentreEvent[]>([]);
  const [incidents, setIncidents] = useState<AlarmCentreIncident[]>([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [eventRows, incidentRows] = await Promise.all([
        fetchAlarmEvents(status ? { status } : undefined),
        fetchIncidents()
      ]);
      setEvents(eventRows);
      setIncidents(incidentRows);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load alarm centre.');
    }
  }, [status]);

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

  const onAcknowledge = async (alarmEventId: string) => {
    setBusyId(alarmEventId);
    try {
      await acknowledgeAlarmEvent(alarmEventId, 'Acknowledged from Ops Centre');
      await load();
    } catch (ackError) {
      setError(ackError instanceof Error ? ackError.message : 'Acknowledge failed.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
        GridFlex alarms are advisory only. They do not replace protection relays, PPC safety interlocks, or BMS
        protection.
      </div>

      {error && (
        <div className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>
      )}

      <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Alarm events</h2>
            <p className="text-xs text-slate-500">Tenant-scoped active and acknowledged events.</p>
          </div>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="cleared">Cleared</option>
            <option value="suppressed">Suppressed</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-left text-slate-400">
                <th className="px-3 py-2">Started</th>
                <th className="px-3 py-2">Severity</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Metric</th>
                <th className="px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {events.map((row) => (
                <tr key={row.id} className="border-b border-slate-800 text-slate-200">
                  <td className="px-3 py-2">{new Date(row.startedAt).toLocaleString()}</td>
                  <td className="px-3 py-2">{row.severity}</td>
                  <td className="px-3 py-2">{row.status}</td>
                  <td className="px-3 py-2">{row.title}</td>
                  <td className="px-3 py-2">
                    {row.metricKey ?? '-'}
                    {typeof row.metricValue === 'number' ? `=${row.metricValue}` : ''}
                  </td>
                  <td className="px-3 py-2">
                    {row.status === 'active' ? (
                      <button
                        type="button"
                        disabled={busyId === row.id}
                        onClick={() => void onAcknowledge(row.id)}
                        className="rounded bg-emerald-700 px-2 py-1 text-xs text-white hover:bg-emerald-600 disabled:opacity-50"
                      >
                        Acknowledge
                      </button>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                    No alarm events in scope.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
        <h2 className="mb-1 text-lg font-semibold text-slate-100">Incidents</h2>
        <p className="mb-4 text-xs text-slate-500">Operator-opened incident envelopes linked to alarm events.</p>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-left text-slate-400">
                <th className="px-3 py-2">Opened</th>
                <th className="px-3 py-2">Severity</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Alarms</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((row) => (
                <tr key={row.id} className="border-b border-slate-800 text-slate-200">
                  <td className="px-3 py-2">{new Date(row.openedAt).toLocaleString()}</td>
                  <td className="px-3 py-2">{row.severity}</td>
                  <td className="px-3 py-2">{row.status}</td>
                  <td className="px-3 py-2">{row.title}</td>
                  <td className="px-3 py-2">{row._count?.alarmEvents ?? 0}</td>
                </tr>
              ))}
              {incidents.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                    No incidents in scope.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
