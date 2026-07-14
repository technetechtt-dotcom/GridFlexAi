import React, { useCallback, useEffect, useState } from 'react';

import { fetchAdminAuditLogs, fetchAdminUsers, type AdminAuditLog, type AdminUser } from '../../services/api';
import { useAdminRefresh } from './AdminLayout';

const POLL_MS = 15000;

export function AdminLogsPage() {
  const { autoRefresh, refreshTick } = useAdminRefresh();
  const [rows, setRows] = useState<AdminAuditLog[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userId, setUserId] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (currentPage: number, selectedUserId: string) => {
    try {
      const result = await fetchAdminAuditLogs({
        page: currentPage,
        pageSize,
        userId: selectedUserId || undefined
      });
      setRows(result.data);
      setTotal(result.total);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load audit logs.');
    }
  }, [pageSize]);

  useEffect(() => {
    void fetchAdminUsers()
      .then(setUsers)
      .catch(() => setUsers([]));
  }, [refreshTick]);

  useEffect(() => {
    void load(page, userId);
  }, [load, page, refreshTick, userId]);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const timer = window.setInterval(() => {
      void load(page, userId);
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [autoRefresh, load, page, userId]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={userId}
          onChange={(event) => {
            setPage(1);
            setUserId(event.target.value);
          }}
          className="min-w-[240px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100">
          <option value="">All users activity</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name} ({user.email}) — {user.role}
            </option>
          ))}
        </select>
        <p className="text-xs text-slate-500">Ops Center can inspect every user&apos;s login, logout, and actions.</p>
      </div>
      {error && <div className="mb-3 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 text-left text-slate-400">
              <th className="px-3 py-2">Time</th>
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Entity</th>
              <th className="px-3 py-2">Message</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-800 text-slate-200">
                <td className="px-3 py-2">{new Date(row.createdAt).toLocaleString()}</td>
                <td className="px-3 py-2">{row.userEmail ?? 'system'}</td>
                <td className="px-3 py-2">{row.action}</td>
                <td className="px-3 py-2">{row.entityType}{row.entityId ? `:${row.entityId}` : ''}</td>
                <td className="px-3 py-2">{row.message ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center justify-between text-sm text-slate-300">
        <span>
          Page {page} / {totalPages} ({total} total)
        </span>
        <div className="flex gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            className="rounded border border-slate-700 px-3 py-1 disabled:opacity-50">
            Previous
          </button>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            className="rounded border border-slate-700 px-3 py-1 disabled:opacity-50">
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
