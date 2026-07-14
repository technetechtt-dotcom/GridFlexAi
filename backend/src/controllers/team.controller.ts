import type { Request, Response } from "express";

import type { CreateManagedOperatorBody, RecordActivityBody } from "../schemas/request.schemas.js";
import {
  createManagedOperator,
  getManagedOperatorActivity,
  getManagerTeamOverview,
  recordUserActivity
} from "../services/team.service.js";
import { AppError } from "../utils/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const getTeamOverviewHandler = asyncHandler(async (req: Request, res: Response) => {
  const managerId = req.user?.id;
  if (!managerId) {
    throw new AppError("Authentication required.", 401);
  }
  const overview = await getManagerTeamOverview(managerId);
  res.status(200).json({ data: overview });
});

export const postManagedOperatorHandler = asyncHandler(async (
  req: Request<Record<string, never>, unknown, CreateManagedOperatorBody>,
  res: Response
) => {
  const managerId = req.user?.id;
  if (!managerId) {
    throw new AppError("Authentication required.", 401);
  }
  const operator = await createManagedOperator(managerId, req.body);
  res.status(201).json({ data: operator });
});

export const getTeamActivityHandler = asyncHandler(async (req: Request, res: Response) => {
  const managerId = req.user?.id;
  if (!managerId) {
    throw new AppError("Authentication required.", 401);
  }
  const page = Number(req.query.page ?? 1);
  const pageSize = Number(req.query.pageSize ?? 50);
  const result = await getManagedOperatorActivity(managerId, {
    page: Number.isFinite(page) ? page : 1,
    pageSize: Number.isFinite(pageSize) ? pageSize : 50
  });
  res.status(200).json(result);
});

export const postActivityHandler = asyncHandler(async (
  req: Request<Record<string, never>, unknown, RecordActivityBody>,
  res: Response
) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError("Authentication required.", 401);
  }
  const payload: {
    action: string;
    message?: string;
    metadata?: unknown;
    entityType?: string;
    entityId?: string;
  } = { action: req.body.action };
  if (typeof req.body.message === "string") payload.message = req.body.message;
  if (typeof req.body.entityType === "string") payload.entityType = req.body.entityType;
  if (typeof req.body.entityId === "string") payload.entityId = req.body.entityId;
  if (req.body.metadata !== undefined) payload.metadata = req.body.metadata;
  await recordUserActivity(userId, payload);
  res.status(201).json({ message: "Activity recorded." });
});
