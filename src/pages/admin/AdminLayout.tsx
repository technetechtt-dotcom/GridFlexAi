import React, { createContext, useContext, useMemo, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { RefreshCcw } from 'lucide-react';

type AdminRefreshContextValue = {
  autoRefresh: boolean;
  setAutoRefresh: (value: boolean) => void;
  refreshTick: number;
  triggerRefresh: () => void;
};

const AdminRefreshContext = createContext<AdminRefreshContextValue | undefined>(undefined);

export function useAdminRefresh() {
  const context = useContext(AdminRefreshContext);
  if (!context) {
    throw new Error('useAdminRefresh must be used inside AdminLayout');
  }
  return context;
}

const navItemClass = ({ isActive }: { isActive: boolean }) =>
`px-3 py-2 rounded-lg text-sm transition-colors ${
  isActive ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-300 hover:bg-slate-800'
}`;

export function AdminLayout() {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);

  const value = useMemo(
    () => ({
      autoRefresh,
      setAutoRefresh,
      refreshTick,
      triggerRefresh: () => setRefreshTick((prev) => prev + 1)
    }),
    [autoRefresh, refreshTick]
  );

  return (
    <AdminRefreshContext.Provider value={value}>
      <div className="space-y-4 p-6 pb-24">
        <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-slate-100">Developer Console</h1>
              <p className="text-sm text-slate-400">Platform health, users, nodes, metrics, and audit logs.</p>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <span>Auto refresh</span>
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(event) => setAutoRefresh(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-emerald-500"
                />
              </label>
              <button
                onClick={() => setRefreshTick((prev) => prev + 1)}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500">
                <RefreshCcw className="h-4 w-4" />
                Refresh All
              </button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <NavLink to="/admin" end className={navItemClass}>
              Overview
            </NavLink>
            <NavLink to="/admin/users" className={navItemClass}>
              Users
            </NavLink>
            <NavLink to="/admin/nodes" className={navItemClass}>
              Nodes
            </NavLink>
            <NavLink to="/admin/metrics" className={navItemClass}>
              Metrics
            </NavLink>
            <NavLink to="/admin/logs" className={navItemClass}>
              Audit Logs
            </NavLink>
          </div>
        </div>

        <Outlet />
      </div>
    </AdminRefreshContext.Provider>
  );
}

