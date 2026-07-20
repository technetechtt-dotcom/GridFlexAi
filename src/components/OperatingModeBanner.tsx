import React, { useEffect, useState } from "react";

import {
  OPERATING_MODE_LABELS,
  type GridFlexOperatingMode,
  type OperatingModeResponse
} from "../lib/operatingMode";
import { fetchOperatingMode } from "../services/api";

const toneClasses: Record<OperatingModeResponse["bannerTone"] | "red", string> = {
  blue: "border-sky-500/40 bg-sky-500/15 text-sky-100",
  amber: "border-amber-500/40 bg-amber-500/15 text-amber-100",
  green: "border-emerald-500/40 bg-emerald-500/15 text-emerald-100",
  red: "border-rose-500/40 bg-rose-500/15 text-rose-100"
};

const watermarkClasses: Record<OperatingModeResponse["bannerTone"] | "red", string> = {
  blue: "text-sky-500/10",
  amber: "text-amber-500/10",
  green: "text-emerald-500/5",
  red: "text-rose-500/15"
};

type Props = {
  isLiveStreamConnected: boolean;
  metricsStale: boolean;
};

/**
 * Persistent, unavoidable mode banner + watermark.
 * Mode is determined by the backend (GRIDFLEX_OPERATING_MODE), not the browser.
 */
export function OperatingModeBanner({ isLiveStreamConnected, metricsStale }: Props) {
  const [modeInfo, setModeInfo] = useState<OperatingModeResponse | null>(null);

  useEffect(() => {
    let mounted = true;
    void fetchOperatingMode()
      .then((data) => {
        if (mounted) setModeInfo(data);
      })
      .catch(() => {
        if (mounted) {
          setModeInfo({
            mode: "SIMULATION",
            label: OPERATING_MODE_LABELS.SIMULATION,
            defaultTelemetryEnvironment: "simulation",
            liveNamespace: "/",
            simulationNamespace: "/simulation",
            liveTelemetryPath: "/api/v2/telemetry",
            simulationTelemetryPath: "/api/simulation/telemetry",
            simulationRunId: null,
            bannerTone: "blue"
          });
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  const mode: GridFlexOperatingMode = modeInfo?.mode ?? "SIMULATION";
  const disconnected =
    (mode === "PILOT_LIVE" || mode === "PRODUCTION_ADVISORY" || mode === "HIL") &&
    (!isLiveStreamConnected || metricsStale);
  const tone = disconnected ? "red" : (modeInfo?.bannerTone ?? "blue");
  const label = disconnected
    ? "Stale / disconnected — last measured values held; not live"
    : modeInfo?.label ?? OPERATING_MODE_LABELS[mode];

  return (
    <>
      <div
        className={`sticky top-0 z-50 border-b px-4 py-2 text-center text-xs font-semibold tracking-wide ${toneClasses[tone]}`}
        role="status"
        aria-live="polite"
      >
        {label}
        {modeInfo?.simulationRunId ? (
          <span className="ml-2 font-normal opacity-80">· run {modeInfo.simulationRunId}</span>
        ) : null}
        <span className="ml-2 font-normal opacity-70">
          · live {modeInfo?.liveTelemetryPath ?? "/api/v2/telemetry"} · sim{" "}
          {modeInfo?.simulationTelemetryPath ?? "/api/simulation/telemetry"}
        </span>
      </div>
      <div
        className={`pointer-events-none fixed inset-0 z-30 flex items-center justify-center overflow-hidden ${watermarkClasses[tone]}`}
        aria-hidden
      >
        <p className="select-none text-[12vw] font-black uppercase tracking-[0.2em] -rotate-12">
          {disconnected ? "STALE" : mode.replace(/_/g, " ")}
        </p>
      </div>
    </>
  );
}
