import type { Request, Response } from "express";

import {
  listDeviceCredentials,
  provisionDeviceCredential,
  revokeDeviceCredential
} from "../services/device-credential.service.js";
import { ingestTelemetryBatch, listTelemetryReadings } from "../services/telemetry.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";

export const postTelemetryBatchHandler = asyncHandler(async (req: Request, res: Response) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  const result = await ingestTelemetryBatch(items);
  res.status(202).json({ data: result });
});

export const getTelemetryReadingsHandler = asyncHandler(async (req: Request, res: Response) => {
  const filters: {
    organisationId?: string;
    siteId?: string;
    plantId?: string;
    assetId?: string;
    key?: string;
    page?: number;
    pageSize?: number;
  } = {};
  if (typeof req.query.organisationId === "string") filters.organisationId = req.query.organisationId;
  if (typeof req.query.siteId === "string") filters.siteId = req.query.siteId;
  if (typeof req.query.plantId === "string") filters.plantId = req.query.plantId;
  if (typeof req.query.assetId === "string") filters.assetId = req.query.assetId;
  if (typeof req.query.key === "string") filters.key = req.query.key;
  if (req.query.page) filters.page = Number(req.query.page);
  if (req.query.pageSize) filters.pageSize = Number(req.query.pageSize);

  const result = await listTelemetryReadings(filters, req.user);
  res.status(200).json(result);
});

export const postDeviceCredentialHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError("Authentication required.", 401);
  const edgeNodeId = req.params.edgeNodeId;
  if (!edgeNodeId) throw new AppError("edgeNodeId is required.", 400);
  const payload: { edgeNodeId: string; actorId: string; expiresAt?: Date } = {
    edgeNodeId,
    actorId: req.user.id
  };
  if (typeof req.body?.expiresAt === "string") {
    payload.expiresAt = new Date(req.body.expiresAt);
  }
  const data = await provisionDeviceCredential(payload);
  res.status(201).json({
    message: "Device credential provisioned. Secret is shown once only.",
    data
  });
});

export const getDeviceCredentialsHandler = asyncHandler(async (req: Request, res: Response) => {
  const edgeNodeId = req.params.edgeNodeId;
  if (!edgeNodeId) throw new AppError("edgeNodeId is required.", 400);
  const data = await listDeviceCredentials(edgeNodeId);
  res.status(200).json({ data });
});

export const postRevokeDeviceCredentialHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError("Authentication required.", 401);
  const credentialId = req.params.credentialId;
  if (!credentialId) throw new AppError("credentialId is required.", 400);
  const data = await revokeDeviceCredential({
    credentialId,
    actorId: req.user.id
  });
  res.status(200).json({ data });
});
