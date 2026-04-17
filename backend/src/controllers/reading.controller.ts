import type { Request, Response } from "express";
import type { ParsedQs } from "qs";

import { getReadings, getReadingsSummary, ingestEdgeData as ingestEdgeDataService } from "../services/reading.service.js";
import type { EdgeDataBody, ReadingsQuery, ReadingsSummaryQuery } from "../schemas/request.schemas.js";
import { asyncHandler } from "../utils/asyncHandler.js";
type ReadingsResponse = {
  data: Awaited<ReturnType<typeof getReadings>>["items"];
  pagination: Awaited<ReturnType<typeof getReadings>>["pagination"];
  filters: Awaited<ReturnType<typeof getReadings>>["filters"];
};

type IngestionResponse = {
  message: string;
  data: Awaited<ReturnType<typeof ingestEdgeDataService>>["data"];
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

  const result = await getReadings(filters);

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
  const deviceKey = req.header("x-gridflex-device-id") ?? undefined;
  const result = await ingestEdgeDataService(req.body, deviceKey);

  res.status(201).json({
    message: result.message,
    data: result.data
  });
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

  const data = await getReadingsSummary(filters);
  res.status(200).json({ data });
});
