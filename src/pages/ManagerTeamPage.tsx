import React, { useCallback, useEffect, useState } from 'react';
import { MapPin, Users } from 'lucide-react';

import {
  createManagedOperator,
  fetchManagerTeamActivity,
  fetchManagerTeamOverview,
  type ManagerTeamOverview,
  type TeamActivityLog
} from '../services/api';

export function ManagerTeamPage() {
  const [overview, setOverview] = useState<ManagerTeamOverview | null>(null);
  const [activity, setActivity] = useState<TeamActivityLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });

  const load = useCallback(async () => {
    try {
      const [team, logs] = await Promise.all([
        fetchManagerTeamOverview(),
        fetchManagerTeamActivity({ page: 1, pageSize: 40 })
      ]);
      setOverview(team);
      setActivity(logs.data);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load team data.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await createManagedOperator(form);
      setForm({ name: '', email: '', password: '' });
      await load();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to create operator.');
    } finally {
      setBusy(false);
    }
  };

  const provisioning = overview?.provisioning;
  const assignedSite = overview?.site;

  return (
    <div className="space-y-6 p-6 pb-20">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-cyan-500/10 p-2 text-cyan-400">
          <Users className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">Operator team</h1>
          <p className="text-sm text-slate-400">
            Create plant operators and monitor their login, logout, and in-app activity.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
          <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-slate-500">
            <MapPin className="h-3.5 w-3.5" />
            Assigned site
          </p>
          <p className="mt-2 text-lg font-semibold text-slate-100">
            {assignedSite ? assignedSite.name : 'Unassigned'}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {assignedSite ? `${assignedSite.code} | ${assignedSite.client.name}` : 'Ops Center must assign your manager account to a plant/site.'}
          </p>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Operator creation</p>
          <p className="mt-2 text-lg font-semibold text-slate-100">
            {provisioning?.enabled ? 'Activated' : 'Not activated'}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Ops Center must enable this for your manager account.
          </p>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Quota</p>
          <p className="mt-2 text-lg font-semibold text-slate-100">
            {provisioning?.operatorCount ?? 0} / {provisioning?.maxOperators ?? 2}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {provisioning?.remainingSlots ?? 0} slot(s) remaining
          </p>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Tracking</p>
          <p className="mt-2 text-lg font-semibold text-slate-100">Assigned operators only</p>
          <p className="mt-1 text-xs text-slate-400">
            Login, logout, and recorded operator actions appear below.
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-xl border border-slate-700 bg-slate-900 p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-100">Create operator</h2>
          {!provisioning?.enabled ? (
            <p className="text-sm text-amber-200">
              Operator account creation is locked until Ops Center assigns your manager account to a site and activates operator accounts.
            </p>
          ) : (
            <form onSubmit={onCreate} className="space-y-3">
              <input
                required
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Full name"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              />
              <input
                required
                type="email"
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                placeholder="Email"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              />
              <input
                required
                type="password"
                minLength={8}
                value={form.password}
                onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                placeholder="Temporary password (min 8)"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              />
              <button
                type="submit"
                disabled={busy || (provisioning.remainingSlots ?? 0) <= 0}
                className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-50">
                {busy ? 'Creating…' : 'Create operator'}
              </button>
            </form>
          )}

          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-left text-slate-400">
                  <th className="px-2 py-2">Name</th>
                  <th className="px-2 py-2">Email</th>
                  <th className="px-2 py-2">Site</th>
                  <th className="px-2 py-2">Last login</th>
                </tr>
              </thead>
              <tbody>
                {(overview?.operators ?? []).map((operator) => (
                  <tr key={operator.id} className="border-b border-slate-800 text-slate-200">
                    <td className="px-2 py-2">{operator.name}</td>
                    <td className="px-2 py-2">{operator.email}</td>
                    <td className="px-2 py-2">{operator.site ? `${operator.site.name} (${operator.site.code})` : 'Unassigned'}</td>
                    <td className="px-2 py-2">
                      {operator.lastLoginAt ? new Date(operator.lastLoginAt).toLocaleString() : 'Never'}
                    </td>
                  </tr>
                ))}
                {(overview?.operators.length ?? 0) === 0 && (
                  <tr>
                    <td colSpan={4} className="px-2 py-4 text-slate-500">
                      No operators assigned yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-slate-700 bg-slate-900 p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-100">Operator activity</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-left text-slate-400">
                  <th className="px-2 py-2">Time</th>
                  <th className="px-2 py-2">Operator</th>
                  <th className="px-2 py-2">Action</th>
                  <th className="px-2 py-2">Details</th>
                </tr>
              </thead>
              <tbody>
                {activity.map((row) => (
                  <tr key={row.id} className="border-b border-slate-800 text-slate-200">
                    <td className="px-2 py-2 whitespace-nowrap">{new Date(row.createdAt).toLocaleString()}</td>
                    <td className="px-2 py-2">{row.userName ?? row.userEmail ?? '—'}</td>
                    <td className="px-2 py-2">{row.action}</td>
                    <td className="px-2 py-2">{row.message ?? '—'}</td>
                  </tr>
                ))}
                {activity.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-2 py-4 text-slate-500">
                      No operator activity yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
