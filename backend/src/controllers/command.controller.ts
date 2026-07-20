import type { Request, Response } from "express";
import {
  CommandApprovalDecision,
  CommandOverrideState,
  CommandRequestStatus,
  MeasurementUnit
} from "@prisma/client";

import {
  cancelCommandRequest,
  createCommandRequest,
  decideCommandApproval,
  executeApprovedCommand,
  getCommandRequest,
  isPhysicalExecutionEnabled,
  listCommandRequests,
  setCommandOverrideState,
  submitCommandForApproval
} from "../services/command.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";

export const getCommandsHandler = asyncHandler(async (req: Request, res: Response) => {
  const filters: {
    status?: CommandRequestStatus;
    plantId?: string;
    siteId?: string;
  } = {};
  if (typeof req.query.status === "string") {
    filters.status = req.query.status as CommandRequestStatus;
  }
  if (typeof req.query.plantId === "string") {
    filters.plantId = req.query.plantId;
  }
  if (typeof req.query.siteId === "string") {
    filters.siteId = req.query.siteId;
  }
  const data = await listCommandRequests(filters, req.user);
  res.status(200).json({
    data,
    meta: {
      physicalCommandExecutionEnabled: isPhysicalExecutionEnabled(),
      advisoryNote: "Physical plant actuation is disabled. Executor is simulated only."
    }
  });
});

export const getCommandHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id;
  if (!id) throw new AppError("id is required.", 400);
  const data = await getCommandRequest(id, req.user);
  res.status(200).json({ data });
});

export const postCommandHandler = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as {
    organisationId: string;
    siteId: string;
    plantId: string;
    targetAssetId: string;
    commandType: string;
    requestedValue: number;
    unit: MeasurementUnit;
    currentValue?: number;
    minimumAllowed?: number;
    maximumAllowed?: number;
    maxRampPerMinute?: number;
    reason: string;
    source?: "operator" | "zolt_ai" | "optimisation" | "system";
    riskLevel?: "low" | "medium" | "high" | "critical";
    requireSeparationOfDuties?: boolean;
    optimisationRunId?: string;
    expiresAt: string;
    advisoryOnly?: boolean;
    metadata?: unknown;
  };

  const data = await createCommandRequest(
    {
      ...body,
      expiresAt: body.expiresAt
    },
    req.user
  );
  res.status(201).json({ data });
});

export const postSubmitCommandHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id;
  if (!id) throw new AppError("id is required.", 400);
  const data = await submitCommandForApproval(id, req.user);
  res.status(200).json({ data });
});

export const postApproveCommandHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id;
  if (!id) throw new AppError("id is required.", 400);
  if (!req.user) throw new AppError("Authentication required.", 401);
  const data = await decideCommandApproval(
    id,
    CommandApprovalDecision.approved,
    typeof req.body?.reason === "string" ? req.body.reason : undefined,
    req.user
  );
  res.status(200).json({ data });
});

export const postRejectCommandHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id;
  if (!id) throw new AppError("id is required.", 400);
  if (!req.user) throw new AppError("Authentication required.", 401);
  const data = await decideCommandApproval(
    id,
    CommandApprovalDecision.rejected,
    typeof req.body?.reason === "string" ? req.body.reason : undefined,
    req.user
  );
  res.status(200).json({ data });
});

export const postCancelCommandHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id;
  if (!id) throw new AppError("id is required.", 400);
  const emergency = Boolean(req.body?.emergency);
  const data = await cancelCommandRequest(
    id,
    typeof req.body?.reason === "string" ? req.body.reason : undefined,
    req.user,
    emergency
  );
  res.status(200).json({ data });
});

export const postOverrideCommandHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id;
  if (!id) throw new AppError("id is required.", 400);
  const overrideState = req.body?.overrideState as CommandOverrideState;
  if (!overrideState) throw new AppError("overrideState is required.", 400);
  const data = await setCommandOverrideState(id, overrideState, req.user);
  res.status(200).json({ data });
});

export const postExecuteCommandHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id;
  if (!id) throw new AppError("id is required.", 400);
  const data = await executeApprovedCommand(id, req.user);
  res.status(200).json({
    data,
    meta: {
      executorMode: "simulated",
      physicalCommandExecutionEnabled: isPhysicalExecutionEnabled()
    }
  });
});
