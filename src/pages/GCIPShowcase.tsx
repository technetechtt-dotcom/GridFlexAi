import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  Leaf,
  ShieldCheck,
  Sparkles,
  Zap,
  Calculator,
  Brain,
  Briefcase,
  Landmark
} from 'lucide-react';
import type { Page } from '../components/Sidebar';
import { loadOfflineDemoPack } from '../lib/offlineDemoPack';
import { ProductInfoQr } from '../components/ProductInfoQr';
import {
  DEMO_JOURNEY_STEPS,
  DEMO_TIMER_SECONDS,
  DEMO_TIMER_STORAGE_KEY,
  FROZEN_PACK_BADGE
} from '../lib/demoJourney';

interface GCIPShowcaseProps {
  onNavigate: (page: Page) => void;
}

const stepCards = [
  {
    title: 'Pilot case',
    copy: 'One synthetic site: capacity, period, loss, cause, action, value and internal reviewer confirmation.',
    icon: Eye,
    page: 'pilot-case' as Page
  },
  {
    title: 'Climate impact',
    copy: 'Recovered energy, Rand value and avoided CO₂ with measured/modelled/estimated labels.',
    icon: Calculator,
    page: 'climate-impact' as Page
  },
  {
    title: 'Commercial value',
    copy: 'Show how GridFlex earns fees while the customer keeps recovered value.',
    icon: Briefcase,
    page: 'commercial-value' as Page
  },
  {
    title: 'AI evidence',
    copy: 'Inputs, forecast method, curtailment vs failure, confidence and human approval.',
    icon: Brain,
    page: 'ai-evidence' as Page
  },
  {
    title: 'Ask & next milestone',
    copy: 'Funding request, telemetry-only pilot path, and QR to sanitized product information.',
    icon: Landmark,
    page: 'gcip-ask' as Page
  }
];

const proofPoints = [
  'Retrospective pilot labelled clearly — not invented “achieved” savings',
  'South African rand, grid constraints and Northern Cape operating context',
  'Signed edge telemetry with replay protection and tenant isolation',
  'Clear separation between measured, modelled, estimated and potential impact',
  'Advisory-only recommendations; physical plant execution remains locked',
  'PostgreSQL audit trail for operator decisions (not browser localStorage)',
  'IP sits in loss attribution, trust pipeline and verification — not the dashboard skin'
];

export function GCIPShowcase({ onNavigate }: GCIPShowcaseProps) {
  const offline = loadOfflineDemoPack();

  useEffect(() => {
    localStorage.setItem('gridflex_demo_mode_v1', '1');
    document.documentElement.classList.add('gf-projector');
    const base = import.meta.env.VITE_API_BASE_URL || '/api';
    const roots = [base.replace(/\/$/, ''), 'https://gridflex-backend.onrender.com/api'];
    for (const root of roots) {
      void fetch(`${root}/health/live`).catch(() => undefined);
    }
  }, []);

  const startDemonstration = () => {
    const deadline = Date.now() + DEMO_TIMER_SECONDS * 1000;
    localStorage.setItem(DEMO_TIMER_STORAGE_KEY, String(deadline));
    onNavigate('pilot-case');
  };

  return (
    <div className="gf-projector-text space-y-8 p-4 pb-24 sm:p-6 lg:p-8">
      <section className="relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/80 via-slate-900 to-slate-950 p-6 sm:p-8 lg:p-10">
        <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="relative grid gap-8 lg:grid-cols-[1.45fr_0.75fr] lg:items-center">
          <div>
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300/90">
              Techne Tech · GridFlex AI
            </div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200 sm:text-sm">
              <Leaf className="h-3.5 w-3.5" />
              GCIP Demonstration · pack {FROZEN_PACK_BADGE}
            </div>
            <h1 className="max-w-4xl text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl">
              Recover renewable energy that South Africa already produces.
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-relaxed text-slate-300 sm:text-lg">
              One clear pilot case. Defensible impact math. A commercial model judges can follow. Evidence for what the
              AI does — without claiming ordinary alarms as advanced intelligence.
            </p>
            <div className="mt-7">
              <button
                type="button"
                onClick={startDemonstration}
                className="inline-flex min-h-14 items-center gap-2 rounded-xl bg-emerald-400 px-7 py-4 text-lg font-semibold text-slate-950 transition hover:bg-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:ring-offset-2 focus:ring-offset-slate-950">
                Start demonstration
                <ArrowRight className="h-5 w-5" />
              </button>
              <p className="mt-3 text-sm text-slate-400">
                Starts the 7:00 timer and opens step 1 of {DEMO_JOURNEY_STEPS.length}.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-700/80 bg-slate-950/70 p-5 shadow-2xl shadow-emerald-950/40">
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-300">
              <ShieldCheck className="h-4 w-4" />
              Safe competition mode
            </div>
            <div className="mt-4 space-y-3 text-sm sm:text-base">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="text-slate-400">Data environment</span>
                <span className="font-medium text-sky-300">Retrospective / labelled</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="text-slate-400">Decision mode</span>
                <span className="font-medium text-amber-300">Operator advisory</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Physical execution</span>
                <span className="font-medium text-emerald-300">Locked off</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-400">The judge journey</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-50 sm:text-3xl">Five working demonstration steps.</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {stepCards.map((step, index) => (
            <motion.button
              key={step.title}
              type="button"
              onClick={() => onNavigate(step.page)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="group rounded-2xl border border-slate-800 bg-slate-900/80 p-5 text-left transition hover:-translate-y-0.5 hover:border-emerald-500/40 hover:bg-slate-900">
              <div className="flex items-center justify-between">
                <div className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-300">
                  <step.icon className="h-5 w-5" />
                </div>
                <span className="text-xs font-medium text-slate-600">0{index + 1}</span>
              </div>
              <h3 className="mt-5 text-lg font-semibold text-slate-100 sm:text-xl">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400 sm:text-base">{step.copy}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-emerald-400 sm:text-sm">
                Open step <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
              </span>
            </motion.button>
          ))}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-6">
          <div className="flex items-center gap-2 text-sm font-medium text-sky-300">
            <Zap className="h-4 w-4" />
            Offline fallback ready
          </div>
          <h2 className="mt-3 text-2xl font-semibold text-slate-50">If the network hiccups, keep talking.</h2>
          <p className="mt-4 text-sm leading-7 text-slate-400 sm:text-base">
            {offline.label}. Pilot case, calculators, AI evidence and PDF all work from embedded retrospective data.
          </p>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-300 sm:text-base">
            {offline.talkingPoints.slice(0, 4).map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-400">Built for adoption</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-50 sm:text-2xl">What is demonstrable today</h2>
          <ul className="mt-5 space-y-3">
            {proofPoints.map((point) => (
              <li key={point} className="flex gap-3 text-sm leading-relaxed text-slate-300 sm:text-base">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => onNavigate('blueprint')}
            className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-emerald-400">
            <Sparkles className="h-4 w-4" /> Platform / IP blueprint
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-6 rounded-2xl border border-slate-700 bg-slate-900/70 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Techne Tech</p>
          <h2 className="mt-1 text-xl font-semibold text-white">Scan for sanitized product information</h2>
          <p className="mt-1 text-sm text-slate-400">Public one-pager for judges — no customer brands, no live control.</p>
        </div>
        <ProductInfoQr size={132} />
      </section>
    </div>
  );
}
