import type { Request, Response } from "express";

import type { SimulationCongestionBody } from "../schemas/request.schemas.js";
import {
  getCongestionNodesSimulation,
  getDynamicLineRatingsSimulation,
  getHydrogenTwinSimulation,
  getPilotReportSimulation,
  getTopologyOptimizationSimulation
} from "../services/simulation.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

type DataResponse<T> = {
  data: T;
};

export const getDynamicLineRatingsController = asyncHandler(async (
  _req: Request<Record<string, never>, DataResponse<Awaited<ReturnType<typeof getDynamicLineRatingsSimulation>>>>,
  res: Response<DataResponse<Awaited<ReturnType<typeof getDynamicLineRatingsSimulation>>>>
) => {
  const data = await getDynamicLineRatingsSimulation();
  res.status(200).json({ data });
});

export const getCongestionNodesController = asyncHandler(async (
  req: Request<Record<string, never>, DataResponse<Awaited<ReturnType<typeof getCongestionNodesSimulation>>>, SimulationCongestionBody>,
  res: Response<DataResponse<Awaited<ReturnType<typeof getCongestionNodesSimulation>>>>
) => {
  const data = await getCongestionNodesSimulation(req.body.profiles);
  res.status(200).json({ data });
});

export const getTopologyOptimizationController = asyncHandler(async (
  _req: Request<Record<string, never>, DataResponse<Awaited<ReturnType<typeof getTopologyOptimizationSimulation>>>>,
  res: Response<DataResponse<Awaited<ReturnType<typeof getTopologyOptimizationSimulation>>>>
) => {
  const data = await getTopologyOptimizationSimulation();
  res.status(200).json({ data });
});

export const getHydrogenTwinController = asyncHandler(async (
  _req: Request<Record<string, never>, DataResponse<Awaited<ReturnType<typeof getHydrogenTwinSimulation>>>>,
  res: Response<DataResponse<Awaited<ReturnType<typeof getHydrogenTwinSimulation>>>>
) => {
  const data = await getHydrogenTwinSimulation();
  res.status(200).json({ data });
});

export const getPilotReportController = asyncHandler(async (
  _req: Request<Record<string, never>, DataResponse<Awaited<ReturnType<typeof getPilotReportSimulation>>>>,
  res: Response<DataResponse<Awaited<ReturnType<typeof getPilotReportSimulation>>>>
) => {
  const data = await getPilotReportSimulation();
  res.status(200).json({ data });
});
