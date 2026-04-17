import React, { memo } from 'react';
import { cn } from '../lib/utils';
interface StatusBadgeProps {
  status: 'optimal' | 'warning' | 'critical' | 'offline' | 'active';
  label?: string;
  className?: string;
}
export const StatusBadge = memo(function StatusBadge({
  status,
  label,
  className
}: StatusBadgeProps) {
  const styles = {
    optimal: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    active: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    critical: 'bg-red-500/10 text-red-400 border-red-500/20',
    offline: 'bg-slate-700/50 text-slate-400 border-slate-600/50'
  };
  const dots = {
    optimal: 'bg-emerald-400',
    active: 'bg-cyan-400',
    warning: 'bg-amber-400',
    critical: 'bg-red-400',
    offline: 'bg-slate-400'
  };
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
        styles[status],
        className
      )}>

      <span
        className={cn(
          'w-1.5 h-1.5 rounded-full mr-1.5',
          dots[status],
          status === 'critical' && 'animate-pulse'
        )} />

      {label || status.charAt(0).toUpperCase() + status.slice(1)}
    </span>);

});