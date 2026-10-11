import type { Request, Response } from "express";

import {
  createRecoveryCase,
  listRecoveryCases,
  updateRecoveryCase
} from "../services/recovery-case.service.js";
import { AppError } from "../utils/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const actorFromReq = (req: Request) => {
  if (!req.user) throw new AppError("Authentication required.", 401);
  return { id: req.user.id, name: req.user.name, role: req.user.role };
};

export const getRecoveryCasesHandler = asyncHandler(async (req: Request, res: Response) => {
  const limit = req.query.limit ? Number(req.query.limit) : 100;
  const data = await listRecoveryCases(limit);
  res.status(200).json({ data });
});

export const postRecoveryCaseHandler = asyncHandler(async (req: Request, res: Response) => {
  const data = await createRecoveryCase(req.body, actorFromReq(req));
  res.status(201).json({ data });
});

export const patchRecoveryCaseHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id;
  if (!id) throw new AppError("Case id required.", 400);
  const note = typeof req.body.note === "string" ? req.body.note : "Case updated";
  const { note: _note, ...patch } = req.body as Record<string, unknown> & { note?: string };
  const data = await updateRecoveryCase(id, patch as Parameters<typeof updateRecoveryCase>[1], actorFromReq(req), note);
  res.status(200).json({ data });
});
