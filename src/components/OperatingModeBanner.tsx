import React, { useEffect, useState } from "react";

import {
  type OperatingModeResponse
} from "../lib/operatingMode";
import { fetchOperatingMode } from "../services/api";

const toneClasses: Record<OperatingModeResponse["bannerTone"] | "red" | "slate", string> = {
  blue: "border-sky-500/40 bg-sky-500/15 text-sky-100",
  amber: "border-amber-500/40 bg-amber-500/15 text-amber-100",
  green: "border-emerald-500/40 bg-emerald-500/15 text-emerald-100",
  red: "border-rose-500/40 bg-rose-500/15 text-rose-100",
  slate: "border-slate-500/40 bg-slate-500/15 text-slate-100"
};

const watermarkClasses: Record<OperatingModeResponse["bannerTone"] | "red" | "slate", string> = {
  blue: "text-sky-500/10",
  amber: "text-amber-500/10",
  green: "text-emerald-500/5",
  red: "text-rose-500/15",
  slate: "text-slate-500/10"
};

type Props = {
  isLiveStreamConnected: boolean;
  metricsStale: boolean;
};

/**
 * Persistent, unavoidable mode banner + watermark.
 * Mode is determined by the backend (GRIDFLEX_OPERATING_MODE), not the browser.
 * On fetch failure we show UNKNOWN — never default to Simulation.
 */
export function OperatingModeBanner({ isLiveStreamConnected, metricsStale }: Props) {
  const [modeInfo, setModeInfo] = useState<OperatingModeResponse | null>(null);
  const [modeUnknown, setModeUnknown] = useState(false);

  useEffect(() => {
    let mounted = true;
    void fetchOperatingMode()
      .then((data) => {
        if (mounted) {
          setModeInfo(data);
          setModeUnknown(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setModeInfo(null);
          setModeUnknown(true);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  const disconnected =
    Boolean(modeInfo) &&
    (modeInfo!.mode === "PILOT_LIVE" ||
      modeInfo!.mode === "PRODUCTION_ADVISORY" ||
      modeInfo!.mode === "HIL") &&
    (!isLiveStreamConnected || metricsStale);

  const tone = modeUnknown ? "slate" : disconnected ? "red" : (modeInfo?.bannerTone ?? "slate");
  const label = modeUnknown
    ? "Operating mode unknown — backend unreachable; not assuming simulation"
    : disconnected
      ? "Stale / disconnected — last measured values held; not live"
      : modeInfo
        ? modeInfo.label
        : "Loading operating mode…";

  const watermark = modeUnknown
    ? "UNKNOWN"
    : disconnected
      ? "STALE"
      : modeInfo
        ? modeInfo.mode.replace(/_/g, " ")
        : "…";

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
          {watermark}
        </p>
      </div>
    </>
  );
}

