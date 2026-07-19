import React from 'react';
import { cn } from '../lib/utils';
import {
  DATA_SOURCE_LABELS,
  provenanceTooltip,
  type DataQuality,
  type DataSourceType
} from '../lib/dataProvenance';

const toneBySource: Record<DataSourceType, string> = {
  measured: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  calculated: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300',
  forecast: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
  estimated: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  simulated: 'border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300',
  operator_entered: 'border-slate-500/40 bg-slate-500/10 text-slate-300',
  imported: 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300'
};

interface ProvenanceBadgeProps {
  sourceType: DataSourceType;
  quality?: DataQuality;
  className?: string;
}

export function ProvenanceBadge({ sourceType, quality, className }: ProvenanceBadgeProps) {
  return (
    <span
      title={provenanceTooltip(sourceType, quality)}
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        toneBySource[sourceType],
        className
      )}
    >
      {DATA_SOURCE_LABELS[sourceType]}
      {quality ? ` · ${quality}` : ''}
    </span>
  );
}
