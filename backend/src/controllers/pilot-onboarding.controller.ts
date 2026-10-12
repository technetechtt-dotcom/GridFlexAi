import type { Request, Response } from "express";

import { listOnboardingProgress, upsertOnboardingStep } from "../services/pilot-onboarding.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";

const actorFromReq = (req: Request) => {
  if (!req.user) throw new AppError("Authentication required.", 401);
  return { id: req.user.id, name: req.user.name, role: req.user.role };
};

export const getOnboardingHandler = asyncHandler(async (req: Request, res: Response) => {
  const organisationId =
    typeof req.query.organisationId === "string" ? req.query.organisationId : undefined;
  const data = await listOnboardingProgress(organisationId);
  res.status(200).json({ data });
});

export const putOnboardingStepHandler = asyncHandler(async (req: Request, res: Response) => {
  const data = await upsertOnboardingStep(req.body, actorFromReq(req));
  res.status(200).json({ data });
});
