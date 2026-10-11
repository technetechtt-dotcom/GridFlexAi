import type { Request, Response } from "express";

import {
  createOperatorDecision,
  listOperatorDecisions,
  recordLoginHistoryEntry,
  type CreateOperatorDecisionInput
} from "../services/operator-decision.service.js";
import { AppError } from "../utils/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const postOperatorDecisionHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError("Authentication required.", 401);
  const body = req.body as CreateOperatorDecisionInput;
  const data = await createOperatorDecision(body, {
    id: req.user.id,
    name: req.user.name,
    role: req.user.role
  });
  res.status(201).json({ data });
});

export const getOperatorDecisionsHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError("Authentication required.", 401);
  const filters: { entityType?: string; entityId?: string; limit?: number } = {};
  if (typeof req.query.entityType === "string") filters.entityType = req.query.entityType;
  if (typeof req.query.entityId === "string") filters.entityId = req.query.entityId;
  if (req.query.limit) filters.limit = Number(req.query.limit);
  const data = await listOperatorDecisions(filters);
  res.status(200).json({ data });
});

export const getLoginHistoryHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError("Authentication required.", 401);
  const limit = req.query.limit ? Number(req.query.limit) : 50;
  const data = await recordLoginHistoryEntry(req.user.id, limit);
  res.status(200).json({ data });
});
