import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { createWorkOrder, listWorkOrders, updateWorkOrder, type WorkOrderDto } from '../services/api';
import { useToast } from '../components/useToast';
import { DataStateBanner } from '../components/DataFetchState';

export function OperatorTasksPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { showToast } = useToast();
  const [rows, setRows] = useState<WorkOrderDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('normal');
  const [dueAt, setDueAt] = useState('');
  const [assigneeUserId, setAssigneeUserId] = useState('');
  const [notes, setNotes] = useState('');
  const [evidence, setEvidence] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listWorkOrders());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load work orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const fromAlarm = params.get('fromAlarm');
    if (fromAlarm) {
      setTitle(`Alarm follow-up ${fromAlarm}`);
      setNotes(`Related alarm: ${fromAlarm}`);
    }
  }, [params]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await createWorkOrder({
        title,
        description,
        priority,
        dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
        assigneeUserId: assigneeUserId.trim() || undefined,
        notes: notes || undefined,
        evidence: evidence
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean),
        relatedEntityType: params.get('fromAlarm') ? 'AlarmEvent' : undefined,
        relatedEntityId: params.get('fromAlarm') || undefined
      });
      setTitle('');
      setDescription('');
      setNotes('');
      setEvidence('');
      setDueAt('');
      setAssigneeUserId('');
      showToast('Work order created', 'success');
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Create failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const patch = async (row: WorkOrderDto, payload: Parameters<typeof updateWorkOrder>[1]) => {
    setBusy(true);
    try {
      await updateWorkOrder(row.id, payload);
      showToast('Work order updated', 'success');
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Update failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const isOverdue = (row: WorkOrderDto) =>
    Boolean(row.dueAt && new Date(row.dueAt).getTime() < Date.now() && row.status !== 'closed' && row.status !== 'completed');

  return (
    <div className="space-y-6 p-4 sm:p-6 pb-20">
      <PageHeader
        title="Work orders"
        description="Create from alarms or recommendations; assign, prioritise, evidence, escalate, complete, and approve"
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Operate', onClick: () => navigate('/') },
              { label: 'Work orders' }
            ]}
          />
        }
      />

      <form
        className="grid max-w-2xl gap-3 rounded-xl border border-slate-800 bg-slate-900/50 p-4 sm:p-5 sm:grid-cols-2"
        onSubmit={(e) => void create(e)}>
        <label className="block text-sm text-slate-400 sm:col-span-2">
          Title
          <input
            className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </label>
        <label className="block text-sm text-slate-400 sm:col-span-2">
          Description
          <textarea
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label className="block text-sm text-slate-400">
          Priority
          <select
            className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}>
            {['low', 'normal', 'high', 'urgent', 'critical'].map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm text-slate-400">
          Due date
          <input
            type="datetime-local"
            className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
          />
        </label>
        <label className="block text-sm text-slate-400">
          Assignee user id
          <input
            className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
            value={assigneeUserId}
            onChange={(e) => setAssigneeUserId(e.target.value)}
            placeholder="Optional"
          />
        </label>
        <label className="block text-sm text-slate-400">
          Notes
          <input
            className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        <label className="block text-sm text-slate-400 sm:col-span-2">
          Evidence (one URL or note per line)
          <textarea
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
            rows={2}
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="min-h-11 w-fit rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 disabled:opacity-50 sm:col-span-2">
          Create work order
        </button>
      </form>

      <DataStateBanner
        loading={loading}
        error={error}
        empty={!loading && !error && rows.length === 0}
        emptyMessage="No work orders yet."
        tone="operations"
        onRetry={() => void load()}
      />

      <ul className="space-y-3">
        {rows.map((row) => (
          <li
            key={row.id}
            className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-slate-100">{row.title}</p>
                <p className="text-sm text-slate-400">{row.description || 'No description'}</p>
                <p className="text-xs text-slate-500">
                  {row.status} · {row.priority} · approval {row.approvalStatus ?? 'none'} ·{' '}
                  {row.assigneeName ?? 'unassigned'}
                  {row.dueAt ? ` · due ${new Date(row.dueAt).toLocaleString()}` : ''}
                  {isOverdue(row) ? ' · OVERDUE' : ''}
                  {row.escalatedAt ? ' · escalated' : ''}
                </p>
                {row.notes ? <p className="mt-1 text-xs text-slate-500">Notes: {row.notes}</p> : null}
                {row.completionNotes ? (
                  <p className="mt-1 text-xs text-slate-500">Completion: {row.completionNotes}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy || row.status === 'closed'}
                  onClick={() =>
                    void patch(row, {
                      status:
                        row.status === 'open'
                          ? 'assigned'
                          : row.status === 'assigned'
                            ? 'in_progress'
                            : row.status === 'in_progress' || row.status === 'escalated'
                              ? 'completed'
                              : 'closed',
                      completionNotes:
                        row.status === 'in_progress' || row.status === 'escalated'
                          ? window.prompt('Completion notes') || undefined
                          : undefined
                    })
                  }
                  className="min-h-10 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 disabled:opacity-40">
                  Advance
                </button>
                {isOverdue(row) && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void patch(row, { escalate: true })}
                    className="min-h-10 rounded-lg border border-amber-700/50 px-3 py-1.5 text-xs text-amber-200">
                    Escalate overdue
                  </button>
                )}
                {row.status === 'completed' && (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void patch(row, { approvalStatus: 'approved', status: 'closed' })}
                      className="min-h-10 rounded-lg bg-emerald-500/90 px-3 py-1.5 text-xs font-medium text-slate-950">
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void patch(row, {
                          approvalStatus: 'rejected',
                          status: 'in_progress',
                          notes: `${row.notes}\nRejected: ${window.prompt('Rejection reason') ?? ''}`.trim()
                        })
                      }
                      className="min-h-10 rounded-lg border border-red-700/40 px-3 py-1.5 text-xs text-red-200">
                      Reject
                    </button>
                  </>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
