import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Compass, ArrowLeft, LayoutDashboard } from 'lucide-react';

export function NotFoundPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname + location.search;

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
      <div className="mb-6 rounded-full bg-slate-800 p-4">
        <Compass className="h-10 w-10 text-emerald-400" />
      </div>
      <h1 className="text-2xl font-bold text-slate-100">Page not found</h1>
      <p className="mt-2 max-w-md text-slate-400">
        No route matches{' '}
        <code className="rounded bg-slate-800 px-2 py-0.5 text-sm text-emerald-300">{path}</code>
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          to="/"
          className="inline-flex items-center rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600">
          <LayoutDashboard className="mr-2 h-4 w-4" />
          Return to dashboard
        </Link>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Go back
        </button>
      </div>
      <p className="mt-6 text-sm text-slate-500">
        Need help?{' '}
        <Link to="/help" className="text-emerald-400 hover:text-emerald-300">
          Contact support via Help Centre
        </Link>
      </p>
    </div>
  );
}
