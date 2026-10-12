import React from 'react';
import { ArrowRight, Landmark, Target, Printer, PieChart } from 'lucide-react';
import type { Page } from '../components/Sidebar';
import { ProductInfoQr } from '../components/ProductInfoQr';
import { openVerifiedPilotReport } from '../lib/verifiedPilotReport';
import { openPilotRequestPrint } from '../lib/pilotRequestPrint';
import { FROZEN_PACK_BADGE } from '../lib/demoJourney';
import { FUNDING_ASK, PILOT_90_DAY_DELIVERABLES, USE_OF_FUNDS } from '../lib/fundingAsk';

interface Props {
  onNavigate: (page: Page) => void;
}

/** Final demonstration slide: funding ask + use of funds + deliverables + QR. */
export function GcipAskPage({ onNavigate }: Props) {
  return (
    <div className="gf-projector-text space-y-8 p-4 pb-24 sm:p-6 lg:p-8">
      <section className="rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/90 via-slate-900 to-slate-950 p-6 sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">Step 5 · Close</p>
        <h1 className="mt-3 max-w-4xl text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl">
          Funding request: {FUNDING_ASK.label}
        </h1>
        <p className="mt-4 max-w-3xl text-base text-slate-300 sm:text-lg">
          Techne Tech asks for <strong className="text-emerald-200">{FUNDING_ASK.label}</strong> to deliver a{' '}
          {FUNDING_ASK.periodDays}-day telemetry-only pilot — moving from frozen pack {FROZEN_PACK_BADGE} to a willing
          Northern Cape operator. Still advisory. Physical execution locked unless separately approved in writing.
        </p>

        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-700/80 bg-slate-950/60 p-5">
            <div className="flex items-center gap-2 text-emerald-300">
              <PieChart className="h-5 w-5" />
              <h2 className="text-xl font-semibold text-white">Use of funds</h2>
            </div>
            <ul className="mt-4 space-y-3 text-sm text-slate-300 sm:text-base">
              {USE_OF_FUNDS.map((row) => (
                <li key={row.item} className="flex justify-between gap-3 border-b border-slate-800 pb-2">
                  <span>
                    <span className="font-medium text-slate-100">{row.item}</span>
                    <span className="mt-0.5 block text-xs text-slate-500">{row.note}</span>
                  </span>
                  <span className="shrink-0 font-mono text-emerald-200">
                    {row.pct}% · R {row.zar.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-right text-sm font-semibold text-white">Total {FUNDING_ASK.label}</p>
          </div>

          <div className="rounded-2xl border border-slate-700/80 bg-slate-950/60 p-5">
            <div className="flex items-center gap-2 text-sky-300">
              <Target className="h-5 w-5" />
              <h2 className="text-xl font-semibold text-white">90-day deliverables</h2>
            </div>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-300 sm:text-base">
              {PILOT_90_DAY_DELIVERABLES.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4 text-sm text-amber-100/90">
          <Landmark className="mb-1 inline h-4 w-4" /> Also seeking introductions to operators open to labelled
          retrospective analysis, and budget for independent review once site permission is confirmed.
        </div>

        <div className="mt-8 flex flex-col gap-6 rounded-2xl border border-slate-700 bg-slate-950/50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Handouts & product info</p>
            <p className="mt-1 text-sm text-slate-400">
              Print the one-page pilot request for judges. QR uses a local asset (works offline).
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => openPilotRequestPrint()}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 font-semibold text-slate-950 hover:bg-emerald-300">
                <Printer className="h-4 w-4" /> Print pilot request
              </button>
              <button
                type="button"
                onClick={() => openVerifiedPilotReport()}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-600 px-4 py-2.5 text-slate-100 hover:bg-slate-800">
                Verified pilot PDF
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
