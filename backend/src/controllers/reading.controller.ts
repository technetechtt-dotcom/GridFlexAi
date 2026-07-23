import type { Request, Response } from "express";
import type { ParsedQs } from "qs";

import { getReadings, getReadingsSummary, ingestEdgeData as ingestEdgeDataService } from "../services/reading.service.js";
import { platformMetrics } from "../services/platform-metrics.service.js";
import type { EdgeDataBody, ReadingsQuery, ReadingsSummaryQuery } from "../schemas/request.schemas.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { logger } from "../utils/logger.js";
type ReadingsResponse = {
  data: Awaited<ReturnType<typeof getReadings>>["items"];
  pagination: Awaited<ReturnType<typeof getReadings>>["pagination"];
  filters: Awaited<ReturnType<typeof getReadings>>["filters"];
};

type IngestionResponse = {
  message: string;
  data: Awaited<ReturnType<typeof ingestEdgeDataService>>["data"];
  idempotent?: boolean;
  /** Number when ≤ MAX_SAFE_INTEGER; decimal string otherwise (BIGINT). */
  acknowledgedSequence?: number | string;
};

type ReadingsSummaryResponse = {
  data: Awaited<ReturnType<typeof getReadingsSummary>>;
};

export const listReadings = asyncHandler(async (
  req: Request<Record<string, never>, ReadingsResponse, unknown, ParsedQs>,
  res: Response<ReadingsResponse>
) => {
  const query = req.query as unknown as ReadingsQuery;
  const filters = {
    page: query.page,
    pageSize: query.limit ?? query.pageSize,
    sort: query.sort
  } as Parameters<typeof getReadings>[0];

  if (query.nodeId) {
    filters.nodeId = query.nodeId;
  }
  if (query.startDate) {
    filters.startDate = new Date(query.startDate);
  }
  if (query.endDate) {
    filters.endDate = new Date(query.endDate);
  }
  if (typeof query.windowHours === "number") {
    filters.windowHours = query.windowHours;
  }

  const result = await getReadings(filters, req.user);

  res.status(200).json({
    data: result.items,
    pagination: result.pagination,
    filters: result.filters
  });
});

export const ingestEdgeData = asyncHandler(async (
  req: Request<Record<string, never>, IngestionResponse, EdgeDataBody>,
  res: Response<IngestionResponse>
) => {
  const started = Date.now();
  const deviceKey = req.header("x-gridflex-device-id") ?? undefined;
  try {
    const result = await ingestEdgeDataService(req.body, deviceKey, req.edgeAuth
      ? {
          deviceId: req.edgeAuth.deviceId,
          ...(req.edgeAuth.sequenceNumber !== undefined
            ? { sequenceNumber: req.edgeAuth.sequenceNumber }
            : {}),
          ...(req.edgeAuth.idempotentReplay ? { idempotentReplay: true } : {})
        }
      : undefined);

    platformMetrics.recordIngestAccepted();
    logger.event("edge.ingest.accepted", {
      durationMs: Date.now() - started,
      idempotent: Boolean(result.idempotent),
      ...(result.acknowledgedSequence !== undefined
        ? { sequenceNumber: result.acknowledgedSequence }
        : {})
    });

    res.status(result.idempotent ? 200 : 201).json({
      message: result.message,
      data: result.data,
      ...(result.idempotent ? { idempotent: true } : {}),
      ...(result.acknowledgedSequence !== undefined
        ? { acknowledgedSequence: result.acknowledgedSequence }
        : {})
    });
  } catch (error) {
    platformMetrics.recordIngestRejected();
    logger.event("edge.ingest.rejected", {
      durationMs: Date.now() - started,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
});

export const getReadingsSummaryController = asyncHandler(async (
  req: Request<Record<string, never>, ReadingsSummaryResponse, unknown, ParsedQs>,
  res: Response<ReadingsSummaryResponse>
) => {
  const query = req.query as unknown as ReadingsSummaryQuery;
  const filters = {} as Parameters<typeof getReadingsSummary>[0];

  if (query.nodeId) {
    filters.nodeId = query.nodeId;
  }
  if (query.startDate) {
    filters.startDate = new Date(query.startDate);
  }
  if (query.endDate) {
    filters.endDate = new Date(query.endDate);
  }

  const data = await getReadingsSummary(filters, req.user);
  res.status(200).json({ data });
});
