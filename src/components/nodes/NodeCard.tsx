import React from 'react';
import { Battery, MapPin, RadioTower, Zap } from 'lucide-react';
import type { BackendNode } from '../../services/api';
import { StatusBadge } from '../StatusBadge';
import { LiveStatusIndicator } from './LiveStatusIndicator';

type NodeCardProps = {
  node: BackendNode;
  selected?: boolean;
  onClick?: (node: BackendNode) => void;
};

const metricValue = (value: number | null, suffix: string) =>
  typeof value === 'number' ? `${Math.round(value)}${suffix}` : 'N/A';

export function NodeCard({ node, selected = false, onClick }: NodeCardProps) {
  const latestPower = node.lastReading?.power ?? node.latestReadingSummary.latestPowerKw;
  const siteLabel = node.site ? `${node.site.name} (${node.site.code})` : 'Unassigned site';

  return (
    <button
      type="button"
      onClick={() => onClick?.(node)}
      className={`w-full rounded-lg border p-4 text-left transition-colors ${
        selected
          ? 'border-emerald-400/50 bg-emerald-500/10'
          : 'border-slate-700 bg-slate-900/70 hover:border-slate-500'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-slate-100">{node.name}</h3>
            <StatusBadge status={node.statusBadge} label={node.statusBadge === 'warning' ? 'Warning' : node.status} />
          </div>
          <p className="mt-1 truncate text-xs text-slate-500">{node.serialNumber ?? node.id}</p>
        </div>
        <LiveStatusIndicator status={node.status} lastSeen={node.lastSeen} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-md border border-slate-800 bg-slate-950/60 p-2">
          <span className="flex items-center gap-1.5 text-slate-500">
            <Zap className="h-3.5 w-3.5 text-emerald-300" />
            Last reading
          </span>
          <p className="mt-1 font-mono text-sm text-slate-100">{typeof latestPower === 'number' ? `${latestPower.toFixed(1)} kW` : 'N/A'}</p>
        </div>
        <div className="rounded-md border border-slate-800 bg-slate-950/60 p-2">
          <span className="flex items-center gap-1.5 text-slate-500">
            <Battery className="h-3.5 w-3.5 text-cyan-300" />
            Battery
          </span>
          <p className="mt-1 font-mono text-sm text-slate-100">{metricValue(node.batteryLevel, '%')}</p>
        </div>
        <div className="rounded-md border border-slate-800 bg-slate-950/60 p-2">
          <span className="flex items-center gap-1.5 text-slate-500">
            <RadioTower className="h-3.5 w-3.5 text-amber-300" />
            Signal
          </span>
          <p className="mt-1 font-mono text-sm text-slate-100">{metricValue(node.signalStrength, '')}</p>
        </div>
        <div className="rounded-md border border-slate-800 bg-slate-950/60 p-2">
          <span className="text-slate-500">Health</span>
          <p className="mt-1 font-mono text-sm text-slate-100">{node.healthScore}%</p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
        <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-500" />
        <span className="truncate">{siteLabel} - {node.location}</span>
      </div>
    </button>
  );
}
