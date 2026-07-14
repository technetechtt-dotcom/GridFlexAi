import React from 'react';
import { Wifi, WifiOff, Wrench } from 'lucide-react';
import type { NodeStatus } from '../../services/api';

type LiveStatusIndicatorProps = {
  status: NodeStatus;
  lastSeen: string | null;
};

export function LiveStatusIndicator({ status, lastSeen }: LiveStatusIndicatorProps) {
  const Icon = status === 'online' ? Wifi : status === 'maintenance' ? Wrench : WifiOff;
  const tone =
    status === 'online' ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20' :
    status === 'maintenance' ? 'text-amber-300 bg-amber-500/10 border-amber-500/20' :
    'text-slate-400 bg-slate-800 border-slate-700';
  const label = status === 'online' ? 'Live' : status === 'maintenance' ? 'Maintenance' : 'Offline';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${tone}`}>
      <Icon className={`h-3.5 w-3.5 ${status === 'online' ? 'animate-pulse' : ''}`} />
      {label}
      {lastSeen && <span className="hidden text-slate-500 sm:inline">{new Date(lastSeen).toLocaleTimeString()}</span>}
    </span>
  );
}
