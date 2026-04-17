import type { RequestHandler } from "express";
import NodeCache from "node-cache";

import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";
import { createEdgeSignature, safeSignatureEquals } from "../utils/edgeDeviceAuth.js";

const replayCache = new NodeCache({
  stdTTL: env.EDGE_INGEST_MAX_SKEW_SECONDS * 2,
  useClones: false,
  checkperiod: Math.max(30, Math.floor(env.EDGE_INGEST_MAX_SKEW_SECONDS / 2))
});

const HEADER_DEVICE_ID = "x-gridflex-device-id";
const HEADER_TIMESTAMP = "x-gridflex-timestamp";
const HEADER_NONCE = "x-gridflex-nonce";
const HEADER_SIGNATURE = "x-gridflex-signature";

const getSingleHeader = (value: string | string[] | undefined): string | null => {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
};

export const clearEdgeReplayCache = () => {
  replayCache.flushAll();
};

export const verifyEdgeDeviceAuth: RequestHandler = (req, _res, next) => {
  const deviceId = getSingleHeader(req.headers[HEADER_DEVICE_ID]);
  const timestamp = getSingleHeader(req.headers[HEADER_TIMESTAMP]);
  const nonce = getSingleHeader(req.headers[HEADER_NONCE]);
  const signature = getSingleHeader(req.headers[HEADER_SIGNATURE]);

  if (!deviceId || !timestamp || !nonce || !signature) {
    next(new AppError("Missing edge device authentication headers.", 401));
    return;
  }

  if (deviceId.length > 128 || nonce.length > 128) {
    next(new AppError("Invalid edge authentication header format.", 401));
    return;
  }

  const timestampMs = Number(timestamp);
  if (!Number.isFinite(timestampMs)) {
    next(new AppError("Invalid edge timestamp header.", 401));
    return;
  }

  const maxSkewMs = env.EDGE_INGEST_MAX_SKEW_SECONDS * 1000;
  const drift = Math.abs(Date.now() - timestampMs);
  if (drift > maxSkewMs) {
    next(new AppError("Edge request timestamp outside allowed clock skew.", 401));
    return;
  }

  const replayKey = `${deviceId}:${nonce}`;
  if (replayCache.get(replayKey)) {
    next(new AppError("Replay request detected for edge ingestion.", 409));
    return;
  }

  const expectedSignature = createEdgeSignature(
    {
      deviceId,
      timestamp,
      nonce,
      payload: req.body
    },
    env.EDGE_INGEST_SHARED_SECRET
  );
  if (!safeSignatureEquals(signature, expectedSignature)) {
    next(new AppError("Invalid edge request signature.", 401));
    return;
  }

  replayCache.set(replayKey, true, env.EDGE_INGEST_MAX_SKEW_SECONDS * 2);
  next();
};
