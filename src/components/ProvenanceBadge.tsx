import React from 'react';
import { cn } from '../lib/utils';
import type { ImpactClass } from '../lib/pilotCase';
import { IMPACT_CLASS_HELP, IMPACT_CLASS_LABEL } from '../lib/pilotCase';

const STYLES: Record<ImpactClass | 'live' | 'simulated', string> = {
  measured: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200',
  modelled: 'border-sky-500/40 bg-sky-500/15 text-sky-200',
  estimated: 'border-amber-500/40 bg-amber-500/15 text-amber-200',
  potential: 'border-violet-500/40 bg-violet-500/15 text-violet-200',
  live: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200',
  simulated: 'border-fuchsia-500/40 bg-fuchsia-500/15 text-fuchsia-200'
};

export function ProvenanceBadge({
  kind,
  className
}: {
  kind: ImpactClass | 'live' | 'simulated';
  className?: string;
}) {
  const label =
    kind === 'live' ? 'Live' : kind === 'simulated' ? 'Simulated' : IMPACT_CLASS_LABEL[kind];
  const title =
    kind === 'live' || kind === 'simulated' ? undefined : IMPACT_CLASS_HELP[kind];
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
        STYLES[kind],
        className
      )}>
      {label}
    </span>
  );
}
