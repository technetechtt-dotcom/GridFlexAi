import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BellRing } from 'lucide-react';
import {
  acknowledgeAlarmEvent,
  clearAlarmEvent,
  createAlarmRule,
  fetchAlarmEvents,
  fetchAlarmRules,
  type AlarmCentreEvent,
  type AlarmRuleDto
} from '../services/api';
import { PageHeader } from '../components/PageHeader';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { DataStateBanner } from '../components/DataFetchState';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';

export function AlarmRulesPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useAuth();
  const canEdit = user?.role === 'admin' || user?.role === 'developer' || user?.role === 'manager';
  const [events, setEvents] = useState<AlarmCentreEvent[]>([]);
  const [history, setHistory] = useState<AlarmCentreEvent[]>([]);
  const [rules, setRules] = useState<AlarmRuleDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [orgId, setOrgId] = useState('');
  const [ruleForm, setRuleForm] = useState({
    name: '',
    metricKey: 'export_kw',
    threshold: 100,
    severity: 'warning',
    comparator: 'gt',
    description: '',
    cooldownSeconds: 300
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [openEvents, allEvents, ruleRows] = await Promise.all([
        fetchAlarmEvents({ status: 'active' }),
        fetchAlarmEvents(),
        fetchAlarmRules()
      ]);
      setEvents(openEvents);
      setHistory(allEvents.slice(0, 50));
      setRules(ruleRows);
      if (ruleRows[0]?.organisationId) setOrgId(ruleRows[0].organisationId);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load alarms.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onAck = async (id: string) => {
    const note = window.prompt('Acknowledgement note (optional)') ?? undefined;
    setBusyId(id);
    try {
      await acknowledgeAlarmEvent(id, note || undefined);
      showToast('Alarm acknowledged', 'success');
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Acknowledge failed', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const onClear = async (id: string) => {
    const note = window.prompt('Resolution note (required for closure)');
    if (!note?.trim()) {
      showToast('Resolution note is required to close an alarm', 'error');
      return;
    }
    setBusyId(id);
    try {
      await clearAlarmEvent(id, note.trim());
      showToast('Alarm cleared', 'success');
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Clear failed', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const onCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      showToast('Managers or admins can create alarm rules', 'error');
      return;
    }
    if (!orgId.trim()) {
      showToast('Enter organisationId for the new rule', 'error');
      return;
    }
    setBusyId('create-rule');
    try {
      await createAlarmRule({
        organisationId: orgId.trim(),
        name: ruleForm.name,
        description: ruleForm.description || undefined,
        metricKey: ruleForm.metricKey,
        comparator: ruleForm.comparator,
        threshold: Number(ruleForm.threshold),
        severity: ruleForm.severity,
        cooldownSeconds: Number(ruleForm.cooldownSeconds),
        enabled: true
      });
      showToast('Alarm rule created', 'success');
      setRuleForm((f) => ({ ...f, name: '', description: '' }));
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Create rule failed', 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6 p-6 pb-20">
      <PageHeader
        title="Alarm rules & events"
        description="Create thresholds, acknowledge active alarms, add resolution notes, and review history"
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Overview', onClick: () => navigate('/') },
              { label: 'Alarms' }
            ]}
          />
        }
      />

      <DataStateBanner
        loading={loading}
        error={error}
        empty={false}
        emptyMessage=""
        tone="operations"
        onRetry={() => void load()}
      />

      {canEdit && (
        <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
          <h2 className="mb-3 font-semibold text-slate-100">Create alarm rule</h2>
          <form className="grid gap-3 md:grid-cols-2" onSubmit={(e) => void onCreateRule(e)}>
            <label className="block text-xs text-slate-400 md:col-span-2">
              Organisation ID
              <input
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                value={orgId}
                onChange={(e) => setOrgId(e.target.value)}
                required
              />
            </label>
            <label className="block text-xs text-slate-400">
              Rule name
              <input
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                value={ruleForm.name}
                onChange={(e) => setRuleForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </label>
            <label className="block text-xs text-slate-400">
              Metric key
              <input
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                value={ruleForm.metricKey}
                onChange={(e) => setRuleForm((f) => ({ ...f, metricKey: e.target.value }))}
                required
              />
            </label>
            <label className="block text-xs text-slate-400">
              Comparator
              <select
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                value={ruleForm.comparator}
                onChange={(e) => setRuleForm((f) => ({ ...f, comparator: e.target.value }))}>
                {['gt', 'gte', 'lt', 'lte', 'eq', 'neq'].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-slate-400">
              Threshold
              <input
                type="number"
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                value={ruleForm.threshold}
                onChange={(e) => setRuleForm((f) => ({ ...f, threshold: Number(e.target.value) }))}
                required
              />
            </label>
            <label className="block text-xs text-slate-400">
              Severity
              <select
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                value={ruleForm.severity}
                onChange={(e) => setRuleForm((f) => ({ ...f, severity: e.target.value }))}>
                {['info', 'warning', 'major', 'critical'].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-slate-400">
              Cooldown (seconds)
              <input
                type="number"
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                value={ruleForm.cooldownSeconds}
                onChange={(e) => setRuleForm((f) => ({ ...f, cooldownSeconds: Number(e.target.value) }))}
              />
            </label>
            <label className="block text-xs text-slate-400 md:col-span-2">
              Description / notification destination notes
              <textarea
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                rows={2}
                value={ruleForm.description}
                onChange={(e) => setRuleForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="e.g. Notify control room Slack #alarms; escalate after 15 minutes"
              />
            </label>
            <button
              type="submit"
              disabled={busyId === 'create-rule'}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-50 md:col-span-2 md:w-fit">
              {busyId === 'create-rule' ? 'Creating…' : 'Create rule'}
            </button>
          </form>
        </section>
      )}

      <section>
        <h2 className="mb-3 font-semibold text-slate-100">Rules ({rules.length})</h2>
        <ul className="space-y-2">
          {rules.map((rule) => (
            <li key={rule.id} className="rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-3 text-sm text-slate-300">
              <span className="font-medium text-slate-100">{rule.name}</span> · {rule.metricKey} {rule.comparator}{' '}
              {rule.threshold} · {rule.severity} · {rule.enabled ? 'enabled' : 'disabled'}
              {rule.description ? <p className="mt-1 text-xs text-slate-500">{rule.description}</p> : null}
            </li>
          ))}
          {!rules.length && !loading && <li className="text-sm text-slate-500">No rules yet.</li>}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 font-semibold text-slate-100">Active alarms</h2>
        <ul className="space-y-3">
          {events.map((ev) => (
            <li key={ev.id} className="flex flex-wrap gap-3 rounded-lg border border-slate-800 bg-slate-900/50 p-4">
              <BellRing className="h-5 w-5 shrink-0 text-amber-400" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-100">{ev.title}</p>
                <p className="text-sm text-slate-400">{ev.message}</p>
                <p className="text-xs text-slate-500">
                  {ev.severity} · {ev.status} · {new Date(ev.startedAt).toLocaleString()}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busyId === ev.id}
                  onClick={() => void onAck(ev.id)}
                  className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-50">
                  Acknowledge
                </button>
                <button
                  type="button"
                  disabled={busyId === ev.id}
                  onClick={() => void onClear(ev.id)}
                  className="rounded-lg bg-emerald-500/90 px-3 py-1.5 text-xs font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-50">
                  Resolve & close
                </button>
              </div>
            </li>
          ))}
          {!events.length && !loading && <li className="text-sm text-slate-500">No active alarms.</li>}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 font-semibold text-slate-100">Alarm history</h2>
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="min-w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Severity</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Started</th>
              </tr>
            </thead>
            <tbody>
              {history.map((ev) => (
                <tr key={ev.id} className="border-t border-slate-800">
                  <td className="px-3 py-2">{ev.title}</td>
                  <td className="px-3 py-2">{ev.severity}</td>
                  <td className="px-3 py-2">{ev.status}</td>
                  <td className="px-3 py-2">{new Date(ev.startedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
