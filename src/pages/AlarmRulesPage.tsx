import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BellRing } from 'lucide-react';
import {
  acknowledgeAlarmEvent,
  assignAlarmEvent,
  clearAlarmEvent,
  createAlarmRule,
  createWorkOrder,
  escalateAlarmEvent,
  fetchAlarmEvents,
  fetchAlarmRules,
  reopenAlarmEvent,
  updateAlarmRule,
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
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [ruleForm, setRuleForm] = useState({
    name: '',
    metricKey: 'export_kw',
    threshold: 100,
    severity: 'warning',
    comparator: 'gt',
    description: '',
    cooldownSeconds: 300,
    notifyChannel: 'ops_channel',
    notifyTarget: '#control-room'
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [openEvents, allEvents, ruleRows] = await Promise.all([
        fetchAlarmEvents({ status: 'active' }),
        fetchAlarmEvents(),
        fetchAlarmRules()
      ]);
      const acknowledged = await fetchAlarmEvents({ status: 'acknowledged' }).catch(() => []);
      setEvents([...openEvents, ...acknowledged]);
      setHistory(allEvents.slice(0, 80));
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

  const destinations = () =>
    ruleForm.notifyTarget.trim()
      ? [{ channel: ruleForm.notifyChannel, target: ruleForm.notifyTarget.trim() }]
      : undefined;

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

  const onAssign = async (id: string) => {
    const assigneeUserId = window.prompt('Assignee user id');
    if (!assigneeUserId?.trim()) return;
    const note = window.prompt('Assignment note (optional)') ?? undefined;
    setBusyId(id);
    try {
      await assignAlarmEvent(id, assigneeUserId.trim(), note || undefined);
      showToast('Alarm assigned', 'success');
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Assign failed', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const onEscalate = async (id: string) => {
    const note = window.prompt('Escalation note') ?? undefined;
    setBusyId(id);
    try {
      await escalateAlarmEvent(id, note || undefined);
      showToast('Alarm escalated', 'success');
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Escalate failed', 'error');
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

  const onReopen = async (id: string) => {
    const note = window.prompt('Why reopen this alarm?') ?? undefined;
    setBusyId(id);
    try {
      await reopenAlarmEvent(id, note || undefined);
      showToast('Alarm reopened', 'success');
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Reopen failed', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const onCreateTask = async (ev: AlarmCentreEvent) => {
    setBusyId(ev.id);
    try {
      await createWorkOrder({
        title: `Alarm follow-up: ${ev.title}`,
        description: ev.message,
        priority: ev.severity === 'critical' || ev.severity === 'major' ? 'high' : 'normal',
        relatedEntityType: 'AlarmEvent',
        relatedEntityId: ev.id,
        notes: `Created from alarm ${ev.id}`
      });
      showToast('Work order created from alarm', 'success');
      navigate('/operator-tasks');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Work order create failed', 'error');
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
      if (editingRuleId) {
        await updateAlarmRule(editingRuleId, {
          name: ruleForm.name,
          description: ruleForm.description || null,
          metricKey: ruleForm.metricKey,
          comparator: ruleForm.comparator,
          threshold: Number(ruleForm.threshold),
          severity: ruleForm.severity,
          cooldownSeconds: Number(ruleForm.cooldownSeconds),
          notificationDestinations: destinations()
        });
        showToast('Alarm rule updated', 'success');
        setEditingRuleId(null);
      } else {
        await createAlarmRule({
          organisationId: orgId.trim(),
          name: ruleForm.name,
          description: ruleForm.description || undefined,
          metricKey: ruleForm.metricKey,
          comparator: ruleForm.comparator,
          threshold: Number(ruleForm.threshold),
          severity: ruleForm.severity,
          cooldownSeconds: Number(ruleForm.cooldownSeconds),
          enabled: true,
          notificationDestinations: destinations()
        });
        showToast('Alarm rule created', 'success');
      }
      setRuleForm((f) => ({ ...f, name: '', description: '' }));
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Rule save failed', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const startEdit = (rule: AlarmRuleDto) => {
    setEditingRuleId(rule.id);
    setOrgId(rule.organisationId);
    const dest = rule.notificationDestinations?.[0];
    setRuleForm({
      name: rule.name,
      metricKey: rule.metricKey,
      threshold: rule.threshold,
      severity: rule.severity,
      comparator: rule.comparator,
      description: rule.description ?? '',
      cooldownSeconds: rule.cooldownSeconds,
      notifyChannel: dest?.channel ?? 'ops_channel',
      notifyTarget: dest?.target ?? ''
    });
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 pb-20">
      <PageHeader
        title="Alarm management"
        description="Rules, thresholds, notifications, acknowledge, assign, escalate, resolve, reopen, and history"
        breadcrumbs={
          <Breadcrumbs
            items={[{ label: 'Monitor', onClick: () => navigate('/') }, { label: 'Alarms' }]}
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
        <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 sm:p-5">
          <h2 className="mb-3 font-semibold text-slate-100">
            {editingRuleId ? 'Edit alarm rule' : 'Create alarm rule'}
          </h2>
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => void onCreateRule(e)}>
            <label className="block text-sm text-slate-400 sm:col-span-2">
              Organisation ID
              <input
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                value={orgId}
                onChange={(e) => setOrgId(e.target.value)}
                required={!editingRuleId}
                disabled={Boolean(editingRuleId)}
              />
            </label>
            <label className="block text-sm text-slate-400">
              Rule name
              <input
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                value={ruleForm.name}
                onChange={(e) => setRuleForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </label>
            <label className="block text-sm text-slate-400">
              Metric key
              <input
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                value={ruleForm.metricKey}
                onChange={(e) => setRuleForm((f) => ({ ...f, metricKey: e.target.value }))}
                required
              />
            </label>
            <label className="block text-sm text-slate-400">
              Comparator
              <select
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                value={ruleForm.comparator}
                onChange={(e) => setRuleForm((f) => ({ ...f, comparator: e.target.value }))}>
                {['gt', 'gte', 'lt', 'lte', 'eq', 'neq'].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm text-slate-400">
              Threshold
              <input
                type="number"
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                value={ruleForm.threshold}
                onChange={(e) => setRuleForm((f) => ({ ...f, threshold: Number(e.target.value) }))}
                required
              />
            </label>
            <label className="block text-sm text-slate-400">
              Severity
              <select
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                value={ruleForm.severity}
                onChange={(e) => setRuleForm((f) => ({ ...f, severity: e.target.value }))}>
                {['info', 'warning', 'major', 'critical'].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm text-slate-400">
              Notification channel
              <select
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                value={ruleForm.notifyChannel}
                onChange={(e) => setRuleForm((f) => ({ ...f, notifyChannel: e.target.value }))}>
                {['ops_channel', 'email', 'webhook', 'sms'].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm text-slate-400">
              Notification destination
              <input
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                value={ruleForm.notifyTarget}
                onChange={(e) => setRuleForm((f) => ({ ...f, notifyTarget: e.target.value }))}
                placeholder="ops@gridflex.ai or #alarms webhook"
              />
            </label>
            <label className="block text-sm text-slate-400 sm:col-span-2">
              Description
              <textarea
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                rows={2}
                value={ruleForm.description}
                onChange={(e) => setRuleForm((f) => ({ ...f, description: e.target.value }))}
              />
            </label>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <button
                type="submit"
                disabled={busyId === 'create-rule'}
                className="min-h-11 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-50">
                {editingRuleId ? 'Save rule' : 'Create rule'}
              </button>
              {editingRuleId && (
                <button
                  type="button"
                  onClick={() => setEditingRuleId(null)}
                  className="min-h-11 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200">
                  Cancel edit
                </button>
              )}
            </div>
          </form>
        </section>
      )}

      <section>
        <h2 className="mb-3 font-semibold text-slate-100">Rules ({rules.length})</h2>
        <ul className="space-y-2">
          {rules.map((rule) => (
            <li
              key={rule.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-3 text-sm text-slate-300">
              <div className="min-w-0">
                <span className="font-medium text-slate-100">{rule.name}</span> · {rule.metricKey}{' '}
                {rule.comparator} {rule.threshold} · {rule.severity} ·{' '}
                {rule.enabled ? 'enabled' : 'disabled'}
                {rule.notificationDestinations?.length ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Notify:{' '}
                    {rule.notificationDestinations
                      .map((d) => `${d.channel}:${d.target}`)
                      .join(', ')}
                  </p>
                ) : null}
              </div>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => startEdit(rule)}
                  className="min-h-10 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200">
                  Edit threshold
                </button>
              )}
            </li>
          ))}
          {!rules.length && !loading && <li className="text-sm text-slate-500">No rules yet.</li>}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 font-semibold text-slate-100">Active / acknowledged alarms</h2>
        <ul className="space-y-3">
          {events.map((ev) => (
            <li
              key={ev.id}
              className="flex flex-wrap gap-3 rounded-lg border border-slate-800 bg-slate-900/50 p-4">
              <BellRing className="h-5 w-5 shrink-0 text-amber-400" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-100">{ev.title}</p>
                <p className="text-sm text-slate-400">{ev.message}</p>
                <p className="text-xs text-slate-500">
                  {ev.severity} · {ev.status} · esc L{ev.escalationLevel ?? 0} ·{' '}
                  {ev.assignee?.name ?? 'unassigned'} · {new Date(ev.startedAt).toLocaleString()}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busyId === ev.id}
                  onClick={() => void onAck(ev.id)}
                  className="min-h-10 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 disabled:opacity-50">
                  Acknowledge
                </button>
                <button
                  type="button"
                  disabled={busyId === ev.id}
                  onClick={() => void onAssign(ev.id)}
                  className="min-h-10 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 disabled:opacity-50">
                  Assign
                </button>
                <button
                  type="button"
                  disabled={busyId === ev.id}
                  onClick={() => void onEscalate(ev.id)}
                  className="min-h-10 rounded-lg border border-amber-700/50 px-3 py-1.5 text-xs text-amber-200 disabled:opacity-50">
                  Escalate
                </button>
                <button
                  type="button"
                  disabled={busyId === ev.id}
                  onClick={() => void onCreateTask(ev)}
                  className="min-h-10 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 disabled:opacity-50">
                  Create task
                </button>
                <button
                  type="button"
                  disabled={busyId === ev.id}
                  onClick={() => void onClear(ev.id)}
                  className="min-h-10 rounded-lg bg-emerald-500/90 px-3 py-1.5 text-xs font-medium text-slate-950 disabled:opacity-50">
                  Resolve
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
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {history.map((ev) => (
                <tr key={ev.id} className="border-t border-slate-800">
                  <td className="px-3 py-2">{ev.title}</td>
                  <td className="px-3 py-2">{ev.severity}</td>
                  <td className="px-3 py-2">{ev.status}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {new Date(ev.startedAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">
                    {(ev.status === 'cleared' || ev.status === 'suppressed') && (
                      <button
                        type="button"
                        disabled={busyId === ev.id}
                        onClick={() => void onReopen(ev.id)}
                        className="min-h-10 rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-200">
                        Reopen
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
