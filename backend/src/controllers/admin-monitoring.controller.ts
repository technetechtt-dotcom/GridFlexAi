import type { Request, Response } from "express";

import {
  getAdminMetrics,
  getAdminNodesOverview,
  getAdminPlatformOverview,
  getAdminUsers,
  getAuditLogs,
  runClearForecastCacheAction,
  runTestNotificationAction,
  updateAdminUserRole,
  updateAdminUserSite
} from "../services/admin-monitoring.service.js";
import { setManagerOperatorProvisioning } from "../services/team.service.js";
import type {
  AdminUserRoleUpdateBody,
  AdminUserSiteUpdateBody,
  ManagerOperatorProvisioningBody
} from "../schemas/request.schemas.js";
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
  const userId = typeof req.query.userId === "string" && req.query.userId.trim() ? req.query.userId.trim() : undefined;
  const options: { page?: number; pageSize?: number; userId?: string } = {};
  if (typeof page === "number" && Number.isFinite(page)) {
    options.page = page;
  }
  if (typeof pageSize === "number" && Number.isFinite(pageSize)) {
    options.pageSize = pageSize;
  }
  if (userId) {
    options.userId = userId;
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

export const patchAdminUserSiteHandler = asyncHandler(async (
  req: Request<{ id: string }, unknown, AdminUserSiteUpdateBody>,
  res: Response
) => {
  const data = await updateAdminUserSite(req.params.id, req.body.siteId, req.user?.id);
  res.status(200).json({ data });
});

export const patchManagerOperatorProvisioningHandler = asyncHandler(async (
  req: Request<{ id: string }, unknown, ManagerOperatorProvisioningBody>,
  res: Response
) => {
  const payload: { enabled: boolean; maxOperators?: number } = { enabled: req.body.enabled };
  if (typeof req.body.maxOperators === "number") {
    payload.maxOperators = req.body.maxOperators;
  }
  const data = await setManagerOperatorProvisioning(req.params.id, payload, req.user?.id);
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
