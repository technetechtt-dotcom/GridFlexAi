import React from 'react';
import { ArrowRight, Landmark, Target } from 'lucide-react';
import type { Page } from '../components/Sidebar';
import { ProductInfoQr } from '../components/ProductInfoQr';
import { openVerifiedPilotReport } from '../lib/verifiedPilotReport';
import { FROZEN_PACK_BADGE } from '../lib/demoJourney';

interface Props {
  onNavigate: (page: Page) => void;
}

/** Final demonstration slide: funding ask + next pilot milestone + QR. */
export function GcipAskPage({ onNavigate }: Props) {
  return (
    <div className="gf-projector-text space-y-8 p-4 pb-24 sm:p-6 lg:p-8">
      <section className="rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/90 via-slate-900 to-slate-950 p-6 sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">Step 5 · Close</p>
        <h1 className="mt-3 max-w-4xl text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl">
          Funding request and next pilot milestone.
        </h1>
        <p className="mt-4 max-w-3xl text-base text-slate-300 sm:text-lg">
          Techne Tech is seeking GCIP support to move from this frozen synthetic demonstration pack (
          {FROZEN_PACK_BADGE}) to a telemetry-only pilot with a willing Northern Cape operator — still advisory,
          still execution-locked until plant approval.
        </p>

        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-700/80 bg-slate-950/60 p-5">
            <div className="flex items-center gap-2 text-emerald-300">
              <Landmark className="h-5 w-5" />
              <h2 className="text-xl font-semibold text-white">What we are asking for</h2>
            </div>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-300 sm:text-base">
              <li>Competition funding to complete a 90-day telemetry-only pilot</li>
              <li>Introductions to plant operators open to labelled retrospective analysis</li>
              <li>Support for independent review once real site permission is confirmed</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-700/80 bg-slate-950/60 p-5">
            <div className="flex items-center gap-2 text-sky-300">
              <Target className="h-5 w-5" />
              <h2 className="text-xl font-semibold text-white">Next pilot milestone</h2>
            </div>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-300 sm:text-base">
              <li>Signed telemetry-only data agreement (no plant brand claims until permission)</li>
              <li>Replace synthetic pack with site-scoped measured windows</li>
              <li>Keep physical execution locked; human approval before any live intervention</li>
            </ul>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-6 rounded-2xl border border-slate-700 bg-slate-950/50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Scan for product info</p>
            <p className="mt-1 text-sm text-slate-400">Sanitized one-pager — no customer names, no live control claims.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => openVerifiedPilotReport()}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 font-semibold text-slate-950 hover:bg-emerald-300">
                Hand over verified PDF
              </button>
              <button
                type="button"
                onClick={() => onNavigate('pilot-case')}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-600 px-4 py-2.5 text-slate-100 hover:bg-slate-800">
                Back to pilot case <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
          <ProductInfoQr size={140} />
        </div>
      </section>
    </div>
  );
}
