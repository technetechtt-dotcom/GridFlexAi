import { Prisma } from "@prisma/client";

import { calculateDataFreshness } from "../domain/units.js";
import { getTelemetryKeyDefinition, isKnownTelemetryKey } from "../domain/telemetry-keys.js";
import { prisma } from "../lib/prisma.js";
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

const INVALID_POLICY = (): "tag" | "reject" =>
  process.env.TELEMETRY_INVALID_POLICY === "reject" ? "reject" : "tag";

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
  let taggedInvalid = 0;
  const errors: Array<{ index: number; message: string }> = [];
  const policy = INVALID_POLICY();

  for (const [index, item] of items.entries()) {
    const asset = assetMap.get(item.assetId);
    if (!asset) {
      rejected += 1;
      errors.push({ index, message: "Unknown assetId." });
      continue;
    }

    if (!isKnownTelemetryKey(item.key) && process.env.TELEMETRY_REQUIRE_KNOWN_KEYS === "true") {
      rejected += 1;
      errors.push({ index, message: `Unknown telemetry key: ${item.key}` });
      continue;
    }

    const catalog = getTelemetryKeyDefinition(item.key);
    const definition = asset.pointDefinitions.find((point) => point.key === item.key) ?? null;

    if (typeof item.numericValue === "number" && !Number.isFinite(item.numericValue)) {
      rejected += 1;
      errors.push({ index, message: "numericValue must be finite." });
      continue;
    }

    let quality: "valid" | "invalid" = "valid";
    const min = definition?.minimumValidValue ?? catalog?.minimumValidValue;
    const max = definition?.maximumValidValue ?? catalog?.maximumValidValue;
    if (typeof item.numericValue === "number") {
      if (
        (typeof min === "number" && item.numericValue < min) ||
        (typeof max === "number" && item.numericValue > max)
      ) {
        if (policy === "reject") {
          rejected += 1;
          errors.push({ index, message: "numericValue outside configured valid range." });
          continue;
        }
        quality = "invalid";
        taggedInvalid += 1;
      }
    }

    try {
      const data: Prisma.TelemetryReadingUncheckedCreateInput = {
        organisationId: asset.plant.organisationId,
        siteId: asset.plant.siteId,
        plantId: asset.plantId,
        assetId: asset.id,
        key: item.key,
        unit: (item.unit as "kW") || definition?.unit || catalog?.unit || "kW",
        quality,
        sourceType: item.sourceType ?? definition?.sourceType ?? catalog?.sourceType ?? "measured",
        environment: "live",
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
    taggedInvalid,
    errors,
    schemaVersion: "2",
    invalidPolicy: policy
  };
};

export const listTelemetryReadings = async (
  filters: {
    organisationId?: string;
    siteId?: string;
    plantId?: string;
    assetId?: string;
    key?: string;
    from?: string;
    to?: string;
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
  if (filters.from || filters.to) {
    where.deviceTimestamp = {};
    if (filters.from) where.deviceTimestamp.gte = new Date(filters.from);
    if (filters.to) where.deviceTimestamp.lte = new Date(filters.to);
  }

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

const BUCKET_SQL: Record<string, string> = {
  "1m": "1 minute",
  "5m": "5 minutes",
  "15m": "15 minutes",
  "1h": "1 hour",
  "1d": "1 day"
};

export const aggregateTelemetryBuckets = async (filters: {
  assetId: string;
  key: string;
  from: string;
  to: string;
  bucket?: keyof typeof BUCKET_SQL;
  actor?: AccessActor;
}) => {
  const bucket = filters.bucket && BUCKET_SQL[filters.bucket] ? filters.bucket : "1h";
  const scope = await getOptionalSiteAccessScope(filters.actor);

  const asset = await prisma.asset.findUnique({
    where: { id: filters.assetId },
    include: { plant: true }
  });
  if (!asset) {
    throw new AppError("Asset not found.", 404);
  }
  if (scope.kind === "site" && asset.plant.siteId !== scope.siteId) {
    throw new AppError("Cross-tenant telemetry access denied.", 403);
  }

  // Timescale-ready pattern: date_trunc bucketing over TelemetryReading.
  const fromDate = new Date(filters.from);
  const toDate = new Date(filters.to);
  let rows: Array<{
    bucket: Date;
    avg_value: number | null;
    min_value: number | null;
    max_value: number | null;
    samples: bigint;
  }> = [];

  if (bucket === "1m") {
    rows = await prisma.$queryRaw`
      SELECT date_trunc('minute', "deviceTimestamp") AS bucket,
        AVG("numericValue") AS avg_value, MIN("numericValue") AS min_value, MAX("numericValue") AS max_value, COUNT(*)::bigint AS samples
      FROM "TelemetryReading"
      WHERE "assetId" = ${filters.assetId} AND "key" = ${filters.key}
        AND "deviceTimestamp" >= ${fromDate} AND "deviceTimestamp" <= ${toDate} AND "quality" <> 'invalid'
      GROUP BY 1 ORDER BY 1 ASC`;
  } else if (bucket === "5m") {
    rows = await prisma.$queryRaw`
      SELECT to_timestamp(floor(extract(epoch from "deviceTimestamp") / 300) * 300) AS bucket,
        AVG("numericValue") AS avg_value, MIN("numericValue") AS min_value, MAX("numericValue") AS max_value, COUNT(*)::bigint AS samples
      FROM "TelemetryReading"
      WHERE "assetId" = ${filters.assetId} AND "key" = ${filters.key}
        AND "deviceTimestamp" >= ${fromDate} AND "deviceTimestamp" <= ${toDate} AND "quality" <> 'invalid'
      GROUP BY 1 ORDER BY 1 ASC`;
  } else if (bucket === "15m") {
    rows = await prisma.$queryRaw`
      SELECT to_timestamp(floor(extract(epoch from "deviceTimestamp") / 900) * 900) AS bucket,
        AVG("numericValue") AS avg_value, MIN("numericValue") AS min_value, MAX("numericValue") AS max_value, COUNT(*)::bigint AS samples
      FROM "TelemetryReading"
      WHERE "assetId" = ${filters.assetId} AND "key" = ${filters.key}
        AND "deviceTimestamp" >= ${fromDate} AND "deviceTimestamp" <= ${toDate} AND "quality" <> 'invalid'
      GROUP BY 1 ORDER BY 1 ASC`;
  } else if (bucket === "1d") {
    rows = await prisma.$queryRaw`
      SELECT date_trunc('day', "deviceTimestamp") AS bucket,
        AVG("numericValue") AS avg_value, MIN("numericValue") AS min_value, MAX("numericValue") AS max_value, COUNT(*)::bigint AS samples
      FROM "TelemetryReading"
      WHERE "assetId" = ${filters.assetId} AND "key" = ${filters.key}
        AND "deviceTimestamp" >= ${fromDate} AND "deviceTimestamp" <= ${toDate} AND "quality" <> 'invalid'
      GROUP BY 1 ORDER BY 1 ASC`;
  } else {
    rows = await prisma.$queryRaw`
      SELECT date_trunc('hour', "deviceTimestamp") AS bucket,
        AVG("numericValue") AS avg_value, MIN("numericValue") AS min_value, MAX("numericValue") AS max_value, COUNT(*)::bigint AS samples
      FROM "TelemetryReading"
      WHERE "assetId" = ${filters.assetId} AND "key" = ${filters.key}
        AND "deviceTimestamp" >= ${fromDate} AND "deviceTimestamp" <= ${toDate} AND "quality" <> 'invalid'
      GROUP BY 1 ORDER BY 1 ASC`;
  }

  return {
    bucket,
    unit: getTelemetryKeyDefinition(filters.key)?.unit ?? null,
    sourceType: getTelemetryKeyDefinition(filters.key)?.sourceType ?? "measured",
    data: rows.map((row) => ({
      bucket: row.bucket.toISOString(),
      avgValue: row.avg_value,
      minValue: row.min_value,
      maxValue: row.max_value,
      samples: Number(row.samples)
    }))
  };
};

export const purgeExpiredTelemetry = async (retentionDays = Number(process.env.TELEMETRY_RETENTION_DAYS ?? 365)) => {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const result = await prisma.telemetryReading.deleteMany({
    where: { ingestedAt: { lt: cutoff } }
  });
  return { deleted: result.count, cutoff: cutoff.toISOString(), retentionDays };
};
