import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

const DEMO_MODE_KEY = 'gridflex_demo_mode_v1';

/** Persistent GCIP / demonstration environment indicator for projector demos. */
export function DemoEnvironmentBanner() {
  const location = useLocation();
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    const fromQuery = new URLSearchParams(location.search).get('demo') === '1';
    const fromStorage = localStorage.getItem(DEMO_MODE_KEY) === '1';
    const fromPath = location.pathname.startsWith('/gcip');
    setDemoMode(fromQuery || fromStorage || fromPath);
    document.documentElement.classList.toggle('gf-projector', fromQuery || fromStorage || fromPath);
  }, [location.pathname, location.search]);

  if (!demoMode) return null;

  return (
    <div className="border-b border-emerald-500/30 bg-emerald-500/15 px-4 py-2 text-center text-sm font-semibold tracking-wide text-emerald-100 sm:text-base">
      GCIP Demonstration · Retrospective / labelled data · Advisory only · Physical execution locked
    </div>
  );
}
