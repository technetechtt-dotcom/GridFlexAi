import type { Request, Response } from "express";

import {
  createDataQualityException,
  ensureDataQualityCatalogue,
  listDataQualityExceptions,
  updateDataQualityException
} from "../services/data-quality.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";

const actorFromReq = (req: Request) => {
  if (!req.user) throw new AppError("Authentication required.", 401);
  return { id: req.user.id, name: req.user.name, role: req.user.role };
};

export const getDataQualityHandler = asyncHandler(async (req: Request, res: Response) => {
  const filters: { status?: string; exceptionType?: string } = {};
  if (typeof req.query.status === "string") filters.status = req.query.status;
  if (typeof req.query.exceptionType === "string") filters.exceptionType = req.query.exceptionType;
  const bootstrap = req.query.bootstrap === "1" || req.query.bootstrap === "true";
  const data = bootstrap
    ? await ensureDataQualityCatalogue(actorFromReq(req))
    : await listDataQualityExceptions(filters);
  res.status(200).json({ data });
});

export const postDataQualityHandler = asyncHandler(async (req: Request, res: Response) => {
  const data = await createDataQualityException(req.body, actorFromReq(req));
  res.status(201).json({ data });
});

export const patchDataQualityHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id;
  if (!id) throw new AppError("id is required.", 400);
  const data = await updateDataQualityException(id, req.body, actorFromReq(req));
  res.status(200).json({ data });
});
