import type { Request, Response } from "express";
import type { GridConstraintType } from "@prisma/client";

import {
  createGridConstraint,
  deleteGridConstraint,
  hasRealGridConstraints,
  listGridConstraints,
  updateGridConstraint
} from "../services/grid-constraint.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";

export const getGridConstraintsHandler = asyncHandler(async (req: Request, res: Response) => {
  const filters: {
    siteId?: string;
    plantId?: string;
    constraintType?: GridConstraintType;
    limit?: number;
  } = {};
  if (typeof req.query.siteId === "string") filters.siteId = req.query.siteId;
  if (typeof req.query.plantId === "string") filters.plantId = req.query.plantId;
  if (typeof req.query.constraintType === "string") {
    filters.constraintType = req.query.constraintType as GridConstraintType;
  }
  if (typeof req.query.limit === "string") filters.limit = Number(req.query.limit);

  const data = await listGridConstraints(filters, req.user);
  const hasReal = await hasRealGridConstraints(req.user);
  res.status(200).json({
    data,
    meta: {
      hasRealConstraints: hasReal,
      simulationFallback: !hasReal
    }
  });
});

export const postGridConstraintHandler = asyncHandler(async (req: Request, res: Response) => {
  const data = await createGridConstraint(req.body, req.user?.id, req.user);
  res.status(201).json({ data });
});

export const patchGridConstraintHandler = asyncHandler(async (req: Request, res: Response) => {
  const constraintId = req.params.constraintId;
  if (!constraintId) throw new AppError("constraintId is required.", 400);
  const data = await updateGridConstraint(constraintId, req.body, req.user?.id, req.user);
  res.status(200).json({ data });
});

export const deleteGridConstraintHandler = asyncHandler(async (req: Request, res: Response) => {
  const constraintId = req.params.constraintId;
  if (!constraintId) throw new AppError("constraintId is required.", 400);
  const data = await deleteGridConstraint(constraintId, req.user?.id, req.user);
  res.status(200).json({ data });
});
