import { Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { calculateDataFreshness } from "../domain/units.js";
import type { AccessActor } from "./access-scope.service.js";
import { getOptionalSiteAccessScope } from "./access-scope.service.js";
import { AppError } from "../utils/AppError.js";

export type TelemetryBatchItem = {
  assetId: string;
  key: string;
  numericValue?: number;
  stringValue?: string;
  booleanValue?: boolean;
  unit: string;
  deviceTimestamp: string;
  sequenceNumber?: number;
  schemaVersion?: string;
  firmwareVersion?: string;
  calibrationVersion?: string;
  qualityFlags?: unknown;
  sourceType?: "measured" | "calculated" | "forecast" | "estimated" | "simulated" | "operator_entered" | "imported";
};

export const ingestTelemetryBatch = async (
  items: TelemetryBatchItem[],
  options: { maxItems?: number } = {}
) => {
  const maxItems = options.maxItems ?? 500;
  if (items.length === 0) {
    throw new AppError("Telemetry batch must include at least one reading.", 400);
  }
  if (items.length > maxItems) {
    throw new AppError(`Telemetry batch exceeds maximum of ${maxItems} items.`, 413);
  }

  const assetIds = [...new Set(items.map((item) => item.assetId))];
  const assets = await prisma.asset.findMany({
    where: { id: { in: assetIds } },
    include: {
      plant: true,
      pointDefinitions: true
    }
  });
  const assetMap = new Map(assets.map((asset) => [asset.id, asset]));

  let accepted = 0;
  let rejected = 0;
  let duplicates = 0;
  const errors: Array<{ index: number; message: string }> = [];

  for (const [index, item] of items.entries()) {
    const asset = assetMap.get(item.assetId);
    if (!asset) {
      rejected += 1;
      errors.push({ index, message: "Unknown assetId." });
      continue;
    }

    const definition = asset.pointDefinitions.find((point) => point.key === item.key);
    let quality: "valid" | "invalid" = "valid";
    if (definition && typeof item.numericValue === "number") {
      if (
        (typeof definition.minimumValidValue === "number" && item.numericValue < definition.minimumValidValue) ||
        (typeof definition.maximumValidValue === "number" && item.numericValue > definition.maximumValidValue)
      ) {
        quality = "invalid";
      }
    }

    try {
      const data: Prisma.TelemetryReadingUncheckedCreateInput = {
        organisationId: asset.plant.organisationId,
        siteId: asset.plant.siteId,
        plantId: asset.plantId,
        assetId: asset.id,
        key: item.key,
        unit: (item.unit as "kW") || definition?.unit || "kW",
        quality,
        sourceType: item.sourceType ?? definition?.sourceType ?? "measured",
        deviceTimestamp: new Date(item.deviceTimestamp),
        sequenceNumber: item.sequenceNumber ?? 0,
        schemaVersion: item.schemaVersion ?? "2"
      };
      if (definition?.id) data.pointDefinitionId = definition.id;
      if (typeof item.numericValue === "number") data.numericValue = item.numericValue;
      if (typeof item.stringValue === "string") data.stringValue = item.stringValue;
      if (typeof item.booleanValue === "boolean") data.booleanValue = item.booleanValue;
      if (typeof item.firmwareVersion === "string") data.firmwareVersion = item.firmwareVersion;
      if (typeof item.calibrationVersion === "string") data.calibrationVersion = item.calibrationVersion;
      if (item.qualityFlags !== undefined) data.qualityFlags = item.qualityFlags as Prisma.InputJsonValue;

      await prisma.telemetryReading.create({ data });
      accepted += 1;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        duplicates += 1;
        continue;
      }
      rejected += 1;
      errors.push({
        index,
        message: error instanceof Error ? error.message : "Failed to persist telemetry reading."
      });
    }
  }

  return {
    accepted,
    rejected,
    duplicates,
    errors,
    schemaVersion: "2"
  };
};

export const listTelemetryReadings = async (
  filters: {
    organisationId?: string;
    siteId?: string;
    plantId?: string;
    assetId?: string;
    key?: string;
    page?: number;
    pageSize?: number;
  },
  actor?: AccessActor
) => {
  const page = filters.page && filters.page > 0 ? filters.page : 1;
  const pageSize = filters.pageSize && filters.pageSize > 0 && filters.pageSize <= 200 ? filters.pageSize : 50;
  const scope = await getOptionalSiteAccessScope(actor);

  const where: Prisma.TelemetryReadingWhereInput = {};
  if (filters.organisationId) where.organisationId = filters.organisationId;
  if (filters.siteId) where.siteId = filters.siteId;
  if (filters.plantId) where.plantId = filters.plantId;
  if (filters.assetId) where.assetId = filters.assetId;
  if (filters.key) where.key = filters.key;

  if (scope.kind === "site") {
    where.siteId = scope.siteId;
  }

  const [total, rows] = await Promise.all([
    prisma.telemetryReading.count({ where }),
    prisma.telemetryReading.findMany({
      where,
      orderBy: [{ deviceTimestamp: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize
    })
  ]);

  return {
    page,
    pageSize,
    total,
    data: rows.map((row) => {
      const freshness = calculateDataFreshness(row.deviceTimestamp);
      return {
        ...row,
        deviceTimestamp: row.deviceTimestamp.toISOString(),
        ingestedAt: row.ingestedAt.toISOString(),
        freshness
      };
    })
  };
};
