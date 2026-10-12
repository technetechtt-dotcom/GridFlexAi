import React from 'react';
import { useLocation } from 'react-router-dom';
import { DEMO_JOURNEY_STEPS, demoStepFromPath, FROZEN_PACK_BADGE } from '../lib/demoJourney';
import { FrontendReleaseBadge } from './FrontendReleaseBadge';
import type { Page } from './Sidebar';

type Props = {
  onNavigate: (page: Page) => void;
};

/** Visible five-step progress for the GCIP judge journey. */
export function DemoProgressBar({ onNavigate }: Props) {
  const { pathname } = useLocation();
  const active = demoStepFromPath(pathname);

  return (
    <div className="border-b border-emerald-500/20 bg-slate-950/90 px-4 py-3 backdrop-blur sm:px-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-400">
          Demonstration progress
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <p className="font-mono text-[11px] text-slate-500">Frozen pack {FROZEN_PACK_BADGE}</p>
          <FrontendReleaseBadge />
        </div>
      </div>
      <ol className="grid grid-cols-5 gap-1.5 sm:gap-2">
        {DEMO_JOURNEY_STEPS.map((step) => {
          const isActive = active === step.id;
          const isDone = active > step.id;
          return (
            <li key={step.id}>
              <button
                type="button"
                onClick={() => onNavigate(step.page)}
                className={`flex w-full flex-col items-center rounded-lg border px-1 py-2 text-center transition sm:px-2 ${
                  isActive
                    ? 'border-emerald-400 bg-emerald-500/20 text-emerald-100'
                    : isDone
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                      : 'border-slate-800 bg-slate-900/60 text-slate-500 hover:border-slate-600 hover:text-slate-300'
                }`}>
                <span className="text-[10px] font-bold sm:text-xs">{step.id}</span>
                <span className="mt-0.5 hidden text-[10px] font-medium leading-tight sm:block sm:text-xs">
                  {step.label}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
