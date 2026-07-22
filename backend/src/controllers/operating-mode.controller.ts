import type { Request, Response } from "express";

import { env, defaultTelemetryEnvironmentFilter, getOperatingMode } from "../config/env.js";
import { OPERATING_MODE_LABELS } from "../domain/operating-mode.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";
import { publishSimulationTick } from "../simulation/publisher.js";

export const getOperatingModeHandler = asyncHandler(async (_req: Request, res: Response) => {
  const mode = getOperatingMode();
  res.status(200).json({
    data: {
      mode,
      label: OPERATING_MODE_LABELS[mode],
      defaultTelemetryEnvironment: defaultTelemetryEnvironmentFilter(),
      liveNamespace: "/",
      simulationNamespace: "/simulation",
      liveTelemetryPath: "/api/v2/telemetry",
      simulationTelemetryPath: "/api/simulation/telemetry",
      bannerTone:
        mode === "SIMULATION"
          ? "blue"
          : mode === "HIL"
            ? "amber"
            : mode === "PILOT_LIVE" || mode === "PRODUCTION_ADVISORY"
              ? "green"
              : "green"
    }
  });
});

/**
 * Explicit simulation ingest endpoint — never writes environment=live.
 * Used by external simulators; the in-process publisher also writes via the same path conceptually.
 */
export const postSimulationTelemetryHandler = asyncHandler(async (req: Request, res: Response) => {
  if (env.GRIDFLEX_OPERATING_MODE !== "SIMULATION" && env.GRIDFLEX_OPERATING_MODE !== "HIL") {
    throw new AppError(
      "Simulation telemetry endpoint is only available when GRIDFLEX_OPERATING_MODE is SIMULATION or HIL.",
      403
    );
  }

  // Trigger one tick when body is empty (demo); otherwise accept structured payload later.
  if (!req.body || Object.keys(req.body as object).length === 0) {
    await publishSimulationTick();
    res.status(202).json({
      message: "Simulation tick published."
    });
    return;
  }

  await publishSimulationTick();
  res.status(202).json({
    message: "Simulation telemetry accepted."
  });
});
