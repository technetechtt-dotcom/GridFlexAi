import React from 'react';
import { Link } from 'react-router-dom';
import { Leaf, ShieldCheck } from 'lucide-react';
import { FROZEN_PACK_BADGE } from '../lib/demoJourney';

/**
 * Sanitized, public product-information page for judges (QR target).
 * No customer brand claims; no live plant control claims.
 */
export function ProductInfoPage() {
  return (
    <div className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-400">
          Techne Tech · GridFlex AI
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Product information (sanitized)
        </h1>
        <p className="mt-4 text-base leading-relaxed text-slate-300">
          GridFlex helps South African renewable operators recover energy lost to grid export constraints —
          with labelled impact math, advisory-only recommendations, and physical execution locked by default.
        </p>

        <ul className="mt-8 space-y-3 text-sm text-slate-300 sm:text-base">
          <li className="flex gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            Demonstration data is a frozen synthetic pack ({FROZEN_PACK_BADGE}) — not a named commercial plant.
          </li>
          <li className="flex gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            Impact classes are marked measured / modelled / estimated / potential.
          </li>
          <li className="flex gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            Reviewer confirmation is internal pilot-desk only — not an independent audit.
          </li>
          <li className="flex gap-2">
            <Leaf className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            Built in South Africa for Northern Cape–style curtailment recovery use cases.
          </li>
        </ul>

        <p className="mt-10 text-sm text-slate-500">
          Contact: Techne Tech · GridFlex AI · Invite-only operator access.
        </p>
        <Link to="/login" className="mt-4 inline-block text-sm font-medium text-emerald-400 hover:text-emerald-300">
          Operator sign-in →
        </Link>
      </div>
    </div>
  );
}
