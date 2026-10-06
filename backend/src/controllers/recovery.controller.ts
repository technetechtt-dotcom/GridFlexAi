import type { Request, Response } from "express";

import { analyseRecoveryOpportunity } from "../domain/recovery-engine.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const postRecoveryAnalyseHandler = asyncHandler(async (req: Request, res: Response) => {
  const samples = Array.isArray(req.body?.samples) ? req.body.samples : [];
  const assumptions =
    req.body?.assumptions && typeof req.body.assumptions === "object" ? req.body.assumptions : undefined;

  const result = analyseRecoveryOpportunity(samples, assumptions);
  res.status(200).json({ data: result });
});
