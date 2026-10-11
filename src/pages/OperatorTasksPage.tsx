import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { createWorkOrder, listWorkOrders, updateWorkOrder, type WorkOrderDto } from '../services/api';
import { useToast } from '../components/Toast';
import { DataStateBanner } from '../components/DataFetchState';

export function OperatorTasksPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [rows, setRows] = useState<WorkOrderDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
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

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await createWorkOrder({ title, description, priority: 'normal' });
      setTitle('');
      setDescription('');
      showToast('Work order created', 'success');
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Create failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const advance = async (row: WorkOrderDto) => {
    const next =
      row.status === 'open'
        ? 'assigned'
        : row.status === 'assigned'
          ? 'in_progress'
          : row.status === 'in_progress'
            ? 'completed'
            : 'closed';
    setBusy(true);
    try {
      await updateWorkOrder(row.id, { status: next });
      showToast(`Work order → ${next}`, 'success');
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Update failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 p-6 pb-20">
      <PageHeader
        title="Operator tasks and work orders"
        description="Create, assign, and close advisory maintenance tasks (PostgreSQL-backed)"
        breadcrumbs={
          <Breadcrumbs items={[{ label: 'Overview', onClick: () => navigate('/') }, { label: 'Work orders' }]} />
        }
      />

      <form className="grid max-w-xl gap-3 rounded-xl border border-slate-800 bg-slate-900/50 p-5" onSubmit={(e) => void create(e)}>
        <label className="block text-xs text-slate-400">
          Title
          <input
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </label>
        <label className="block text-xs text-slate-400">
          Description
          <textarea
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="w-fit rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 disabled:opacity-50">
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
          <li key={row.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <div>
              <p className="font-medium text-slate-100">{row.title}</p>
              <p className="text-sm text-slate-400">{row.description || 'No description'}</p>
              <p className="text-xs text-slate-500">
                {row.status} · {row.priority} · {row.assigneeName ?? 'unassigned'} ·{' '}
                {new Date(row.createdAt).toLocaleString()}
              </p>
            </div>
            <button
              type="button"
              disabled={busy || row.status === 'closed'}
              onClick={() => void advance(row)}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 disabled:opacity-40">
              Advance status
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
