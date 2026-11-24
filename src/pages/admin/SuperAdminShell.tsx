import React, { Suspense } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { SuperAdminSidebar } from '../../components/SuperAdminSidebar';
import { useAuth } from '../../context/useAuth';

export function SuperAdminShell() {
  const { user } = useAuth();
  const environment =
    (import.meta.env.VITE_GRIDFLEX_ENV as string | undefined)?.trim() || 'staging/ops';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans selection:bg-red-500/30">
      <SuperAdminSidebar />
      <main className="relative min-h-screen transition-all duration-300 lg:pl-64">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-red-500/20 bg-red-500/10 px-4 py-2 text-xs text-red-200">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-semibold uppercase tracking-wide">Admin · {user?.role ?? 'ops'}</span>
            <span className="text-red-200/80">Environment: {environment}</span>
          </div>
          <Link
            to="/"
            className="inline-flex items-center rounded-md border border-red-400/30 bg-slate-950/40 px-2 py-1 font-medium text-red-100 hover:bg-slate-900">
            <ArrowLeft className="mr-1 h-3.5 w-3.5" />
            Return to Operations
          </Link>
        </div>
        <ErrorBoundary>
          <Suspense fallback={<LoadingSpinner />}>
            <AnimatePresence mode="wait">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="min-h-screen bg-slate-950"
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </Suspense>
        </ErrorBoundary>
      </main>
    </div>
  );
}
