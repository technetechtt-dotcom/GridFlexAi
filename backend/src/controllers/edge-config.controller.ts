import type { Request, Response } from "express";

import {
  getActiveRemoteConfigForDevice,
  publishRemoteConfig,
  type EdgeRemoteConfigPayload
} from "../services/edge-remote-config.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const getActiveRemoteConfigHandler = asyncHandler(async (_req: Request, res: Response) => {
  const config = await getActiveRemoteConfigForDevice();
  res.status(200).json({
    data: config,
    note: "Verify Ed25519 signature with the pinned public key. Never expect device HMAC secrets here."
  });
});

export const publishRemoteConfigHandler = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as EdgeRemoteConfigPayload;
  const published = await publishRemoteConfig(body, req.user?.id);
  res.status(201).json({
    message: "Remote configuration published.",
    data: published
  });
});
