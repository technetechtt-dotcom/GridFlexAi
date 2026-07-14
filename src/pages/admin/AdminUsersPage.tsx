import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { KeyRound } from 'lucide-react';
import {
  adminResetUserPassword,
  fetchAdminUsers,
  type AdminUser,
  updateAdminUserRole,
  updateManagerOperatorProvisioning
} from '../../services/api';
import { useAdminRefresh } from './AdminLayout';

const POLL_MS = 20000;

export function AdminUsersPage() {
  const { autoRefresh, refreshTick } = useAdminRefresh();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | AdminUser['role']>('all');
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const rows = await fetchAdminUsers();
      setUsers(rows);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load users.');
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

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesSearch =
        user.name.toLowerCase().includes(search.toLowerCase()) ||
        user.email.toLowerCase().includes(search.toLowerCase());
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [roleFilter, search, users]);

  const onRoleChange = async (userId: string, role: AdminUser['role']) => {
    setBusyId(userId);
    try {
      await updateAdminUserRole(userId, role);
      await load();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Failed to update role.');
    } finally {
      setBusyId(null);
    }
  };

  const onResetPassword = async (user: AdminUser) => {
    const newPassword = prompt(`Enter new password for ${user.email} (min 8 characters):`);
    if (!newPassword) return;
    if (newPassword.length < 8) {
      alert('Password must be at least 8 characters long.');
      return;
    }

    setBusyId(user.id);
    try {
      await adminResetUserPassword(user.id, newPassword);
      alert('Password reset successfully.');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to reset password.');
    } finally {
      setBusyId(null);
    }
  };

  const onToggleProvisioning = async (user: AdminUser, enabled: boolean) => {
    setBusyId(user.id);
    try {
      const maxOperators = user.operatorProvisioning?.maxOperators ?? 2;
      await updateManagerOperatorProvisioning(user.id, { enabled, maxOperators: Math.max(2, maxOperators) });
      await load();
    } catch (provisionError) {
      setError(provisionError instanceof Error ? provisionError.message : 'Failed to update operator provisioning.');
    } finally {
      setBusyId(null);
    }
  };

  const onMaxOperatorsChange = async (user: AdminUser, value: number) => {
    const maxOperators = Math.max(2, value || 2);
    setBusyId(user.id);
    try {
      await updateManagerOperatorProvisioning(user.id, {
        enabled: user.operatorProvisioning?.enabled ?? false,
        maxOperators
      });
      await load();
    } catch (provisionError) {
      setError(provisionError instanceof Error ? provisionError.message : 'Failed to update operator quota.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
      <div className="mb-4 rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-xs text-slate-400">
        Ops Center tracks all users. For managers, enable <span className="text-slate-200">Operator accounts</span> to
        allow them to create at least 2 operators and monitor those operators&apos; activity in the plant app.
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search users..."
          className="min-w-[220px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
        />
        <select
          value={roleFilter}
          onChange={(event) => setRoleFilter(event.target.value as typeof roleFilter)}
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100">
          <option value="all">All roles</option>
          <option value="operator">operator</option>
          <option value="manager">manager</option>
          <option value="admin">admin</option>
          <option value="developer">developer</option>
        </select>
      </div>

      {error && <div className="mb-3 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>}

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 text-left text-slate-400">
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Assignment / Provisioning</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Last Login</th>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <tr key={user.id} className="border-b border-slate-800 text-slate-200">
                <td className="px-3 py-2">{user.name}</td>
                <td className="px-3 py-2">{user.email}</td>
                <td className="px-3 py-2">
                  <select
                    value={user.role}
                    disabled={busyId === user.id}
                    onChange={(event) => {
                      void onRoleChange(user.id, event.target.value as AdminUser['role']);
                    }}
                    className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100 disabled:opacity-60">
                    <option value="operator">operator</option>
                    <option value="manager">manager</option>
                    <option value="admin">admin</option>
                    <option value="developer">developer</option>
                  </select>
                </td>
                <td className="px-3 py-2">
                  {user.role === 'manager' ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex items-center gap-1 text-xs text-slate-300">
                        <input
                          type="checkbox"
                          checked={Boolean(user.operatorProvisioning?.enabled)}
                          disabled={busyId === user.id}
                          onChange={(event) => {
                            void onToggleProvisioning(user, event.target.checked);
                          }}
                        />
                        Operator accounts
                      </label>
                      <input
                        type="number"
                        min={2}
                        max={50}
                        disabled={busyId === user.id}
                        value={user.operatorProvisioning?.maxOperators ?? 2}
                        onChange={(event) => {
                          void onMaxOperatorsChange(user, Number(event.target.value));
                        }}
                        className="w-16 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
                        title="Max operators (min 2)"
                      />
                      <span className="text-xs text-slate-500">{user.operatorCount ?? 0} assigned</span>
                    </div>
                  ) : user.role === 'operator' && user.managedBy ? (
                    <span className="text-xs text-slate-400">
                      Manager: {user.managedBy.name} ({user.managedBy.email})
                    </span>
                  ) : (
                    <span className="text-xs text-slate-600">—</span>
                  )}
                </td>
                <td className="px-3 py-2">{user.status}</td>
                <td className="px-3 py-2">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Never'}</td>
                <td className="px-3 py-2">{new Date(user.createdAt).toLocaleDateString()}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => onResetPassword(user)}
                    disabled={busyId === user.id}
                    title="Reset Password"
                    className="rounded bg-slate-800 p-1.5 text-slate-300 transition-colors hover:bg-slate-700 disabled:opacity-50"
                  >
                    <KeyRound className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
