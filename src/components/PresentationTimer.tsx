import React, { useEffect, useState } from 'react';
import { TimerReset } from 'lucide-react';
import { DEMO_TIMER_SECONDS, DEMO_TIMER_STORAGE_KEY } from '../lib/demoJourney';

function readDeadline(): number | null {
  const raw = localStorage.getItem(DEMO_TIMER_STORAGE_KEY);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function formatMmSs(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Floating 7-minute presentation timer for demo mode. */
export function PresentationTimer() {
  const [deadline, setDeadline] = useState<number | null>(() => readDeadline());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  const remaining = deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : DEMO_TIMER_SECONDS;
  const expired = deadline !== null && remaining === 0;

  const start = () => {
    const next = Date.now() + DEMO_TIMER_SECONDS * 1000;
    localStorage.setItem(DEMO_TIMER_STORAGE_KEY, String(next));
    setDeadline(next);
  };

  const reset = () => {
    localStorage.removeItem(DEMO_TIMER_STORAGE_KEY);
    setDeadline(null);
  };

  return (
    <div
      className={`fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl border px-3 py-2 shadow-lg backdrop-blur sm:left-auto sm:right-4 ${
        expired
          ? 'border-amber-400/50 bg-amber-950/90 text-amber-100'
          : 'border-slate-700 bg-slate-950/90 text-slate-100'
      }`}
      role="timer"
      aria-live="polite"
      aria-label="Presentation timer">
      <span className="font-mono text-lg font-semibold tabular-nums sm:text-xl">
        {deadline ? formatMmSs(remaining) : formatMmSs(DEMO_TIMER_SECONDS)}
      </span>
      {!deadline ? (
        <button
          type="button"
          onClick={start}
          className="rounded-lg bg-emerald-500 px-2.5 py-1 text-xs font-semibold text-slate-950 hover:bg-emerald-400">
          Start 7:00
        </button>
      ) : (
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
          title="Reset timer">
          <TimerReset className="h-3.5 w-3.5" />
          Reset
        </button>
      )}
    </div>
  );
}
