import type { Request, Response } from "express";

import { getAdminDashboardOverview, getDashboardOverview } from "../services/dashboard.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

type DashboardResponse = {
  data: Awaited<ReturnType<typeof getDashboardOverview>>;
};

export const getDashboardSummary = asyncHandler(async (
  _req: Request<Record<string, never>, DashboardResponse>,
  res: Response<DashboardResponse>
) => {
  const summary = await getDashboardOverview();
  res.status(200).json({ data: summary });
});

type AdminDashboardResponse = {
  data: Awaited<ReturnType<typeof getAdminDashboardOverview>>;
};

export const getAdminDashboardSummary = asyncHandler(async (
  _req: Request<Record<string, never>, AdminDashboardResponse>,
  res: Response<AdminDashboardResponse>
) => {
  const summary = await getAdminDashboardOverview();
  res.status(200).json({ data: summary });
});
