import React from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Eye,
  Leaf,
  Recycle,
  ShieldCheck,
  Sparkles,
  Zap
} from 'lucide-react';
import type { Page } from '../components/Sidebar';

interface GCIPShowcaseProps {
  onNavigate: (page: Page) => void;
}

const steps = [
  {
    title: 'Curtailment',
    copy: 'Identify renewable energy that is being lost and why it happened.',
    icon: Eye,
    page: 'curtailment-detail' as Page
  },
  {
    title: 'Recovery Centre',
    copy: 'Compare safe recovery options and download an advisory evidence pack.',
    icon: Recycle,
    page: 'recovery' as Page
  },
  {
    title: 'Platform Blueprint',
    copy: 'Show how telemetry, forecasts and advisory decisions stay separated.',
    icon: Sparkles,
    page: 'blueprint' as Page
  },
  {
    title: 'KPI & Reporting',
    copy: 'Present illustrative financial and carbon value — never as customer settlement.',
    icon: BarChart3,
    page: 'kpi' as Page
  }
];

const proofPoints = [
  'South African rand, grid constraints and Northern Cape operating context',
  'Signed edge telemetry with replay protection and tenant isolation',
  'Clear separation between measured, forecast and synthetic demonstration data',
  'Advisory-only recommendations; physical plant execution remains locked',
  'Downloadable evidence for operators, investors and programme reviewers',
  'Designed to expand from solar recovery into storage and green hydrogen'
];

export function GCIPShowcase({ onNavigate }: GCIPShowcaseProps) {
  return (
    <div className="space-y-8 p-4 pb-16 sm:p-6 lg:p-8">
      <section className="relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/80 via-slate-900 to-slate-950 p-6 sm:p-8 lg:p-10">
        <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="relative grid gap-8 lg:grid-cols-[1.45fr_0.75fr] lg:items-center">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200">
              <Leaf className="h-3.5 w-3.5" />
              GCIP competition showcase
            </div>
            <h1 className="max-w-4xl text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl">
              Recover renewable energy that South Africa already produces.
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-relaxed text-slate-300 sm:text-lg">
              GridFlex AI helps renewable operators identify avoidable generation loss, understand
              why it happened, and compare practical recovery options before clean energy and revenue
              are wasted.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => onNavigate('recovery')}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:ring-offset-2 focus:ring-offset-slate-950">
                Run the recovery demonstration
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate('blueprint')}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-900/70 px-5 py-3 font-medium text-slate-100 transition hover:border-emerald-400/50 hover:bg-slate-800">
                View how it works
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-700/80 bg-slate-950/70 p-5 shadow-2xl shadow-emerald-950/40">
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-300">
              <ShieldCheck className="h-4 w-4" />
              Safe competition mode
            </div>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="text-slate-400">Data environment</span>
                <span className="font-medium text-sky-300">Clearly labelled demo</span>
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
          <h2 className="mt-1 text-2xl font-semibold text-slate-50">One problem. Four clear steps.</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {steps.map((step, index) => (
            <motion.button
              key={step.title}
              type="button"
              onClick={() => onNavigate(step.page)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06 }}
              className="group rounded-2xl border border-slate-800 bg-slate-900/80 p-5 text-left transition hover:-translate-y-0.5 hover:border-emerald-500/40 hover:bg-slate-900">
              <div className="flex items-center justify-between">
                <div className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-300">
                  <step.icon className="h-5 w-5" />
                </div>
                <span className="text-xs font-medium text-slate-600">0{index + 1}</span>
              </div>
              <h3 className="mt-5 text-lg font-semibold text-slate-100">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{step.copy}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-emerald-400">
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
            Why this matters
          </div>
          <h2 className="mt-3 text-2xl font-semibold text-slate-50">Curtailment becomes an investment decision, not just an alarm.</h2>
          <p className="mt-4 text-sm leading-7 text-slate-400">
            Operators often see that output fell, but not the commercial value of the loss or the
            best way to respond. GridFlex AI joins telemetry, forecasts and operating constraints so
            the team can move from detection to a traceable recovery case in minutes.
          </p>
          <div className="mt-5 rounded-xl border border-sky-500/20 bg-sky-500/5 p-4 text-sm text-sky-100">
            Competition scenarios use deterministic synthetic inputs labelled{" "}
            <span className="font-semibold">synthetic_demo</span>. Financial and carbon values are
            illustrative — not customer settlement results — until validated against a specific site,
            tariff and engineering design. Physical plant execution remains locked.
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-400">Built for adoption</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-50">What is already demonstrable</h2>
          <ul className="mt-5 space-y-3">
            {proofPoints.map((point) => (
              <li key={point} className="flex gap-3 text-sm leading-relaxed text-slate-300">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">Ready for the live demo</p>
          <h2 className="mt-1 text-xl font-semibold text-white">Show the loss, explain it, then recover its value.</h2>
          <p className="mt-1 text-sm text-slate-400">The recovery scenario takes about two minutes to present.</p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('recovery')}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-emerald-400">
          Start demonstration <ArrowRight className="h-4 w-4" />
        </button>
      </section>
    </div>
  );
}
