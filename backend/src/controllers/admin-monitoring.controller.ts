import type { Request, Response } from "express";

import {
  getAdminMetrics,
  getAdminNodesOverview,
  getAdminPlatformOverview,
  getAdminUsers,
  getAuditLogs,
  runClearForecastCacheAction,
  runTestNotificationAction,
  updateAdminUserRole
} from "../services/admin-monitoring.service.js";
import type { AdminUserRoleUpdateBody } from "../schemas/request.schemas.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const getAdminPlatformOverviewHandler = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAdminPlatformOverview();
  res.status(200).json({ data });
});

export const getAdminUsersHandler = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAdminUsers();
  res.status(200).json({ data });
});

export const getAdminNodesOverviewHandler = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAdminNodesOverview();
  res.status(200).json({ data });
});

export const getAdminMetricsHandler = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAdminMetrics();
  res.status(200).json({ data });
});

export const getAuditLogsHandler = asyncHandler(async (req: Request, res: Response) => {
  const page = req.query.page ? Number.parseInt(String(req.query.page), 10) : undefined;
  const pageSize = req.query.pageSize ? Number.parseInt(String(req.query.pageSize), 10) : undefined;
  const options: { page?: number; pageSize?: number } = {};
  if (typeof page === "number" && Number.isFinite(page)) {
    options.page = page;
  }
  if (typeof pageSize === "number" && Number.isFinite(pageSize)) {
    options.pageSize = pageSize;
  }

  const result = await getAuditLogs(options);
  res.status(200).json(result);
});

export const patchAdminUserRoleHandler = asyncHandler(async (
  req: Request<{ id: string }, unknown, AdminUserRoleUpdateBody>,
  res: Response
) => {
  const data = await updateAdminUserRole(req.params.id, req.body.role);
  res.status(200).json({ data });
});

export const postAdminClearForecastCacheHandler = asyncHandler(async (req: Request, res: Response) => {
  const data = await runClearForecastCacheAction(req.user?.id);
  res.status(200).json({ data });
});

export const postAdminTestNotificationHandler = asyncHandler(async (req: Request, res: Response) => {
  const data = await runTestNotificationAction(req.user?.id);
  res.status(200).json({ data });
});

