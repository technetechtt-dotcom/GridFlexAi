import React from 'react';

interface SimulationBannerProps {
  featureName: string;
  detail?: string;
}

/** Persistent banner for pages that are simulation/advisory only. */
export function SimulationBanner({
  featureName,
  detail = 'Values shown here are simulated or calculated for demonstration. They are not measured plant telemetry and must not be used for physical control decisions.'
}: SimulationBannerProps) {
  return (
    <div className="mb-4 rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/10 px-4 py-3 text-sm text-fuchsia-100">
      <p className="font-semibold">Simulation — {featureName}</p>
      <p className="mt-1 text-xs text-fuchsia-200/90">{detail}</p>
    </div>
  );
}
