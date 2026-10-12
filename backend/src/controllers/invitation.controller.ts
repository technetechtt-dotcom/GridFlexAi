import type { Request, Response } from "express";

import {
  createInvitation,
  forcePasswordReset,
  listInvitations,
  resendInvitation,
  revokeInvitation,
  setUserSuspension
} from "../services/invitation.service.js";
import { listDeploymentRecords } from "../services/deployment-record.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";

const actorFromReq = (req: Request) => {
  if (!req.user) throw new AppError("Authentication required.", 401);
  return { id: req.user.id, name: req.user.name, role: req.user.role };
};

export const getInvitationsHandler = asyncHandler(async (_req: Request, res: Response) => {
  const data = await listInvitations();
  res.status(200).json({ data });
});

export const postInvitationHandler = asyncHandler(async (req: Request, res: Response) => {
  const data = await createInvitation(req.body, actorFromReq(req));
  res.status(201).json({ data });
});

export const postResendInvitationHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id;
  if (!id) throw new AppError("id is required.", 400);
  const data = await resendInvitation(id, actorFromReq(req));
  res.status(200).json({ data });
});

export const postRevokeInvitationHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id;
  if (!id) throw new AppError("id is required.", 400);
  const data = await revokeInvitation(id, actorFromReq(req));
  res.status(200).json({ data });
});

export const postSuspendUserHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id;
  if (!id) throw new AppError("id is required.", 400);
  const suspended = req.body.suspended !== false;
  const data = await setUserSuspension(id, suspended, actorFromReq(req));
  res.status(200).json({ data });
});

export const postForcePasswordResetHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id;
  if (!id) throw new AppError("id is required.", 400);
  const data = await forcePasswordReset(id, actorFromReq(req));
  res.status(200).json({ data });
});

export const getDeploymentRecordsHandler = asyncHandler(async (req: Request, res: Response) => {
  const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : 50;
  const data = await listDeploymentRecords(Number.isFinite(limit) ? limit : 50);
  res.status(200).json({ data });
});
