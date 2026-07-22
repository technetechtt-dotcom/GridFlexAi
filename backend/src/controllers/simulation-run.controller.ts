import type { Request, Response } from "express";

import {
  createSimulationRun,
  getSimulationRun,
  listSimulationRuns,
  stopSimulationRun,
  type CreateSimulationRunInput,
  type ListSimulationRunsInput
} from "../services/simulation-run.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

type RunParams = { runId: string };

export const postSimulationRunHandler = asyncHandler(async (
  req: Request<Record<string, never>, unknown, CreateSimulationRunInput>,
  res: Response
) => {
  const data = await createSimulationRun(req.body, req.user!);
  res.status(201).json({ data });
});

export const getSimulationRunsHandler = asyncHandler(async (
  req: Request<Record<string, never>, unknown, unknown, ListSimulationRunsInput>,
  res: Response
) => {
  const data = await listSimulationRuns(req.query, req.user!);
  res.status(200).json({ data });
});

export const getSimulationRunHandler = asyncHandler(async (
  req: Request<RunParams>,
  res: Response
) => {
  const data = await getSimulationRun(req.params.runId, req.user!);
  res.status(200).json({ data });
});

export const postStopSimulationRunHandler = asyncHandler(async (
  req: Request<RunParams>,
  res: Response
) => {
  const data = await stopSimulationRun(req.params.runId, req.user!);
  res.status(200).json({ data });
});
