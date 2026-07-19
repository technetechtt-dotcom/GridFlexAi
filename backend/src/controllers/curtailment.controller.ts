import type { Request, Response } from "express";
import type { CurtailmentCause, CurtailmentEventStatus } from "@prisma/client";

import {
  addCurtailmentCorrection,
  detectAndPersistCurtailmentEvents,
  getCurtailmentEvent,
  getCurtailmentSummary,
  listCurtailmentEvents,
  reviewCurtailmentEvent
} from "../services/curtailment.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";

export const getCurtailmentEventsHandler = asyncHandler(async (req: Request, res: Response) => {
  const filters: {
    plantId?: string;
    siteId?: string;
    status?: CurtailmentEventStatus;
    cause?: CurtailmentCause;
    limit?: number;
  } = {};
  if (typeof req.query.plantId === "string") filters.plantId = req.query.plantId;
  if (typeof req.query.siteId === "string") filters.siteId = req.query.siteId;
  if (typeof req.query.status === "string") filters.status = req.query.status as CurtailmentEventStatus;
  if (typeof req.query.cause === "string") filters.cause = req.query.cause as CurtailmentCause;
  if (typeof req.query.limit === "string") filters.limit = Number(req.query.limit);

  const data = await listCurtailmentEvents(filters, req.user);
  res.status(200).json({ data });
});

export const getCurtailmentSummaryHandler = asyncHandler(async (req: Request, res: Response) => {
  const data = await getCurtailmentSummary(req.user);
  res.status(200).json({ data });
});

export const getCurtailmentEventHandler = asyncHandler(async (req: Request, res: Response) => {
  const eventId = req.params.eventId;
  if (!eventId) throw new AppError("eventId is required.", 400);
  const data = await getCurtailmentEvent(eventId, req.user);
  res.status(200).json({ data });
});

export const postDetectCurtailmentHandler = asyncHandler(async (req: Request, res: Response) => {
  const data = await detectAndPersistCurtailmentEvents(
    {
      plantId: req.body.plantId,
      samples: req.body.samples
    },
    req.user?.id,
    req.user
  );
  res.status(201).json({ data });
});

export const patchReviewCurtailmentHandler = asyncHandler(async (req: Request, res: Response) => {
  const eventId = req.params.eventId;
  if (!eventId) throw new AppError("eventId is required.", 400);
  const review: { status?: CurtailmentEventStatus; operatorNotes?: string } = {};
  if (req.body.status) review.status = req.body.status;
  if (typeof req.body.operatorNotes === "string") review.operatorNotes = req.body.operatorNotes;
  const data = await reviewCurtailmentEvent(eventId, review, req.user?.id, req.user);
  res.status(200).json({ data });
});

export const postCurtailmentCorrectionHandler = asyncHandler(async (req: Request, res: Response) => {
  const eventId = req.params.eventId;
  if (!eventId) throw new AppError("eventId is required.", 400);
  const payload: {
    notes: string;
    correctedCause?: CurtailmentCause;
    correctedRecoverableEnergyKwh?: number;
  } = { notes: req.body.notes };
  if (req.body.correctedCause) payload.correctedCause = req.body.correctedCause;
  if (typeof req.body.correctedRecoverableEnergyKwh === "number") {
    payload.correctedRecoverableEnergyKwh = req.body.correctedRecoverableEnergyKwh;
  }
  const data = await addCurtailmentCorrection(eventId, payload, req.user?.id, req.user);
  res.status(201).json({ data });
});
