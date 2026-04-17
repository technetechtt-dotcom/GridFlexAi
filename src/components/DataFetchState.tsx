import React from 'react';
import { AlertTriangle, Database, Loader2, RotateCcw } from 'lucide-react';

interface DataStateBannerProps {
  loading: boolean;
  error: string | null;
  empty: boolean;
  emptyMessage?: string;
  loadingMessage?: string;
  tone?: 'operations' | 'analyst';
  onRetry?: () => void;
  retryLabel?: string;
}

export function DataStateBanner({
  loading,
  error,
  empty,
  emptyMessage,
  loadingMessage,
  tone = 'operations',
  onRetry,
  retryLabel = 'Retry'
}: DataStateBannerProps) {
  const toneCopy = tone === 'operations' ?
  {
    loading: 'Syncing live operations feed...',
    empty: 'No live operational records are available for this scope yet.'
  } :
  {
    loading: 'Refreshing analytics dataset...',
    empty: 'No analytical records are available for the selected filter yet.'
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-200 flex items-center">
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        {loadingMessage ?? toneCopy.loading}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200 flex items-center justify-between gap-3">
        <div className="flex items-center min-w-0">
          <AlertTriangle className="w-4 h-4 mr-2 shrink-0" />
          <span className="truncate">{error}</span>
        </div>
        {onRetry &&
        <button
          onClick={onRetry}
          className="inline-flex items-center rounded border border-red-300/30 px-2 py-1 text-xs text-red-100 hover:bg-red-500/20 transition-colors shrink-0">
            <RotateCcw className="w-3 h-3 mr-1" />
            {retryLabel}
          </button>
        }
      </div>
    );
  }

  if (empty) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200 flex items-center">
        <Database className="w-4 h-4 mr-2" />
        {emptyMessage ?? toneCopy.empty}
      </div>
    );
  }

  return null;
}

export function ChartSkeleton({ heightClass = 'h-[300px]' }: {heightClass?: string;}) {
  return (
    <div className={`${heightClass} w-full rounded-lg border border-slate-700 bg-slate-900/50 p-4 animate-pulse`}>
      <div className="h-full w-full grid grid-cols-12 items-end gap-2">
        {Array.from({ length: 12 }, (_, idx) =>
        <div
          key={idx}
          className="bg-slate-700/80 rounded-sm"
          style={{
            height: `${25 + ((idx * 7) % 55)}%`
          }}>
        </div>
        )}
      </div>
    </div>
  );
}
