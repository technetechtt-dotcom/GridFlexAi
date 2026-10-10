import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShieldAlert, LayoutDashboard } from 'lucide-react';

type AccessState = {
  reason?: 'admin' | 'manager';
  from?: { pathname: string };
};

export function AccessDeniedPage() {
  const location = useLocation();
  const state = (location.state ?? {}) as AccessState;

  const detail =
    state.reason === 'admin'
      ? 'Ops Center and platform administration require an admin or developer role.'
      : state.reason === 'manager'
        ? 'This area is limited to plant managers and above.'
        : 'You do not have permission to view this page.';

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
      <div className="mb-6 rounded-full bg-amber-500/10 p-4">
        <ShieldAlert className="h-10 w-10 text-amber-400" />
      </div>
      <h1 className="text-2xl font-bold text-slate-100">Access denied</h1>
      <p className="mt-2 max-w-lg text-slate-400">{detail}</p>
      {state.from?.pathname && (
        <p className="mt-2 text-xs text-slate-500">Requested: {state.from.pathname}</p>
      )}
      <Link
        to="/"
        className="mt-8 inline-flex items-center rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600">
        <LayoutDashboard className="mr-2 h-4 w-4" />
        Return to dashboard
      </Link>
      <p className="mt-4 text-sm text-slate-500">
        If you believe this is an error, ask your administrator to update your role.
      </p>
    </div>
  );
}
