import { NodeStatus, Prisma, TelemetryEnvironment } from "@prisma/client";

import { LIVE_READING_EVENT, NEW_NODE_EVENT, NODE_STATUS_UPDATE_EVENT } from "../config/constants.js";
import { defaultTelemetryEnvironmentFilter } from "../config/env.js";
import { getSocketServer } from "../config/socket.js";
import { emitToSiteScope } from "../lib/socket-rooms.js";
import { prisma } from "../lib/prisma.js";
import type { EdgeDataBody } from "../schemas/request.schemas.js";
import { AppError } from "../utils/AppError.js";
import { getOptionalSiteAccessScope, type AccessActor } from "./access-scope.service.js";
import { createStatusLog, resolveNodeForIngestion } from "./node.service.js";

type ReadingFilters = {
  nodeId?: string;
  page: number;
  pageSize: number;
  sort: "asc" | "desc";
  startDate?: Date;
  endDate?: Date;
  windowHours?: number;
  /** When false (default for live modes), simulated / wrong-environment rows are excluded. */
  includeSimulated?: boolean;
  environment?: TelemetryEnvironment | "all";
};

type ReadingSummaryFilters = {
  nodeId?: string;
  startDate?: Date;
  endDate?: Date;
};

type CreateReadingInput = {
  nodeId?: string;
  deviceKey?: string;
  voltage: number;
  current: number;
  power: number;
  energyToday?: number;
  inverterPower?: number;
  curtailment?: number;
  batteryLevel?: number;
  signalStrength?: number;
  firmwareVersion?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  timestamp?: Date;
  sequenceNumber?: number;
  messageId?: string;
  quality?: "valid" | "invalid" | "uncertain" | "stale";
  qualityFlags?: unknown;
  queueDepth?: number;
  watchdogResetCount?: number;
  restartCount?: number;
  lastResetReason?: string;
  appliedConfigVersion?: string;
  enclosureTemperatureC?: number;
  storageUtilisationPct?: number;
};

const MAX_DATE_RANGE_MS = 1000 * 60 * 60 * 24 * 90; // 90 days

const buildTimestampRange = (input: {
  startDate: Date | undefined;
  endDate: Date | undefined;
  windowHours: number | undefined;
}) => {
  const now = new Date();
  let start = input.startDate;
  let end = input.endDate;

  if (typeof input.windowHours === "number") {
    end = end ?? now;
    start = new Date(end.getTime() - input.windowHours * 60 * 60 * 1000);
  } else {
    if (start && !end) {
      end = now;
    } else if (!start && end) {
      start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
    }
  }

  if (start && end && start > end) {
    throw new AppError("startDate must be before or equal to endDate.", 400);
  }
  if (start && end && end.getTime() - start.getTime() > MAX_DATE_RANGE_MS) {
    throw new AppError("Date range too large. Maximum supported window is 90 days.", 400);
  }

  if (!start && !end) {
    return undefined;
  }

  const range: Prisma.DateTimeFilter = {};
  if (start) {
    range.gte = start;
  }
  if (end) {
    range.lte = end;
  }

  return range;
};

const toIsoIfDate = (value: string | Date | undefined) => {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
};

const applyReadingAccessScope = async (
  where: Prisma.SensorReadingWhereInput,
  actor: AccessActor | undefined
) => {
  const scope = await getOptionalSiteAccessScope(actor);
  if (scope.kind === "site") {
    where.node = {
      is: {
        siteId: scope.siteId
      }
    };
  }
};

export const getReadings = async (
  { nodeId, page, pageSize, sort, startDate, endDate, windowHours, includeSimulated, environment }: ReadingFilters,
  actor?: AccessActor
) => {
  const where: Prisma.SensorReadingWhereInput = {};

  if (nodeId) {
    where.nodeId = nodeId;
  }

  const envFilter = environment ?? defaultTelemetryEnvironmentFilter();
  if (envFilter !== "all") {
    where.environment = envFilter as TelemetryEnvironment;
  }
  if (!includeSimulated && envFilter === "live") {
    where.sourceType = { not: "simulated" };
  }

  const timestampRange = buildTimestampRange({
    startDate,
    endDate,
    windowHours
  });
  if (timestampRange) {
    where.timestamp = timestampRange;
  }

  await applyReadingAccessScope(where, actor);

  const skip = (page - 1) * pageSize;
  const [total, readings] = await Promise.all([
    prisma.sensorReading.count({ where }),
    prisma.sensorReading.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: [{ timestamp: sort }],
      include: {
        node: {
          select: {
            id: true,
            name: true,
            location: true,
            status: true
          }
        }
      }
    })
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return {
    items: readings,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    },
    filters: {
      nodeId: nodeId ?? null,
      startDate: toIsoIfDate(timestampRange?.gte),
      endDate: toIsoIfDate(timestampRange?.lte),
      sort
    }
  };
};

export const getReadingsSummary = async (
  { nodeId, startDate, endDate }: ReadingSummaryFilters,
  actor?: AccessActor
) => {
  const where: Prisma.SensorReadingWhereInput = {};
  if (nodeId) {
    where.nodeId = nodeId;
  }

  const envFilter = defaultTelemetryEnvironmentFilter();
  if (envFilter !== "all") {
    where.environment = envFilter as TelemetryEnvironment;
  }
  if (envFilter === "live") {
    where.sourceType = { not: "simulated" };
  }

  if (startDate || endDate) {
    where.timestamp = {};
    if (startDate) {
      where.timestamp.gte = startDate;
    }
    if (endDate) {
      where.timestamp.lte = endDate;
    }
  }

  await applyReadingAccessScope(where, actor);

  const readings = await prisma.sensorReading.findMany({
    where,
    orderBy: [{ timestamp: "asc" }],
    select: {
      nodeId: true,
      timestamp: true,
      power: true,
      energyToday: true,
      node: {
        select: {
          name: true,
          location: true
        }
      }
    }
  });

  const buckets = new Map<string, typeof readings>();
  for (const reading of readings) {
    const day = reading.timestamp.toISOString().slice(0, 10);
    const key = `${reading.nodeId}:${day}`;
    const list = buckets.get(key) ?? [];
    list.push(reading);
    buckets.set(key, list);
  }

  const summary = Array.from(buckets.entries()).map(([, items]) => {
    const nodeIdForBucket = items[0]?.nodeId ?? "unknown-node";
    const nodeName = items[0]?.node.name ?? "Unknown Node";
    const location = items[0]?.node.location ?? "Unknown";
    const day = items[0]?.timestamp.toISOString().slice(0, 10) ?? new Date().toISOString().slice(0, 10);

    const avgPowerKw = Number(
      (items.reduce((acc, item) => acc + item.power, 0) / Math.max(items.length, 1)).
      toFixed(2)
    );

    const energyTodayValues = items.
    map((item) => item.energyToday).
    filter((value): value is number => typeof value === "number");

    let totalEnergyKwh = 0;
    if (energyTodayValues.length > 0) {
      totalEnergyKwh = Math.max(...energyTodayValues);
    } else if (items.length > 1) {
      for (let i = 1; i < items.length; i += 1) {
        const previous = items[i - 1];
        const current = items[i];
        if (!previous || !current) continue;

        const deltaMs = current.timestamp.getTime() - previous.timestamp.getTime();
        const deltaHours = Math.max(0, Math.min(deltaMs / 3_600_000, 1));
        totalEnergyKwh += ((previous.power + current.power) / 2) * deltaHours;
      }
    } else if (items.length === 1) {
      totalEnergyKwh = items[0]?.power ?? 0;
    }

    return {
      nodeId: nodeIdForBucket,
      nodeName,
      location,
      date: day,
      totalEnergyKwh: Number(totalEnergyKwh.toFixed(2)),
      avgPowerKw,
      samples: items.length
    };
  });

  return summary.sort((a, b) => a.date.localeCompare(b.date));
};

export type IngestionResult = {
  reading: Awaited<ReturnType<typeof prisma.sensorReading.create>> | Awaited<ReturnType<typeof prisma.sensorReading.findUnique>>;
  nodeStatus: {
    id: string;
    name: string;
    location: string;
    status: NodeStatus;
    lastSeen: Date | null;
    createdAt: Date;
    siteId?: string | null;
  };
  isNewNode: boolean;
  idempotent?: boolean;
};

type IngestionEnvelope = {
  message: string;
  data: IngestionResult["reading"];
  idempotent?: boolean;
  acknowledgedSequence?: number;
};

export type EdgeIngestAuthContext = {
  deviceId: string;
  sequenceNumber?: number;
  idempotentReplay?: boolean;
};

export const createReading = async (payload: CreateReadingInput) => {
  const { node, isNewNode } = await resolveNodeForIngestion(payload.nodeId, payload.deviceKey);
  const ingestedAt = new Date();
  const deviceTimestamp = payload.timestamp ?? ingestedAt;

  // Engineering range / sanity checks — flag, do not silently normalize.
  const qualityFlags: Record<string, unknown> = {
    ...((payload.qualityFlags && typeof payload.qualityFlags === "object"
      ? (payload.qualityFlags as Record<string, unknown>)
      : {}) as Record<string, unknown>)
  };
  let quality: "valid" | "invalid" | "uncertain" | "stale" = payload.quality ?? "valid";
  if (!Number.isFinite(payload.voltage) || !Number.isFinite(payload.current) || !Number.isFinite(payload.power)) {
    throw new AppError("voltage, current, and power must be finite numbers.", 400);
  }
  if (payload.voltage < 0 || payload.voltage > 1500) {
    quality = "invalid";
    qualityFlags.excess_voltage = true;
  }
  if (payload.power < -1) {
    quality = quality === "valid" ? "uncertain" : quality;
    qualityFlags.unexpected_negative_pv = true;
  }

  const readingData: Prisma.SensorReadingUncheckedCreateInput = {
    nodeId: node.id,
    voltage: payload.voltage,
    current: payload.current,
    power: payload.power,
    timestamp: deviceTimestamp,
    deviceTimestamp,
    ingestedAt,
    schemaVersion: "1",
    sourceType: "measured",
    quality,
    environment: "live",
    powerUnit: "kW",
    voltageUnit: "V",
    currentUnit: "A",
    qualityFlags: qualityFlags as Prisma.InputJsonValue
  };
  if (node.assetId) {
    readingData.sourceAssetId = node.assetId;
  }
  if (typeof payload.sequenceNumber === "number") {
    readingData.sequenceNumber = payload.sequenceNumber;
  }

  if (typeof payload.energyToday === "number") {
    readingData.energyToday = payload.energyToday;
  }
  if (typeof payload.inverterPower === "number") {
    readingData.inverterPower = payload.inverterPower;
  }
  if (typeof payload.curtailment === "number") {
    readingData.curtailment = payload.curtailment;
  }
  if (typeof payload.firmwareVersion === "string") {
    readingData.firmwareVersion = payload.firmwareVersion;
  }

  let reading;
  try {
    reading = await prisma.sensorReading.create({
      data: readingData,
      include: {
        node: {
          select: {
            id: true,
            name: true,
            location: true,
            status: true
          }
        }
      }
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      typeof payload.sequenceNumber === "number" &&
      payload.deviceKey
    ) {
      const existingReceipt = await prisma.edgeIngestReceipt.findUnique({
        where: {
          deviceId_sequenceNumber: {
            deviceId: payload.deviceKey,
            sequenceNumber: payload.sequenceNumber
          }
        }
      });
      if (existingReceipt?.readingId) {
        const existing = await prisma.sensorReading.findUnique({
          where: { id: existingReceipt.readingId },
          include: {
            node: { select: { id: true, name: true, location: true, status: true } }
          }
        });
        if (existing) {
          return {
            reading: existing,
            nodeStatus: {
              id: existing.node.id,
              name: existing.node.name,
              location: existing.node.location,
              status: existing.node.status,
              lastSeen: null,
              createdAt: ingestedAt
            },
            isNewNode: false,
            idempotent: true
          };
        }
      }
    }
    throw error;
  }

  if (typeof payload.sequenceNumber === "number" && payload.deviceKey) {
    await prisma.edgeIngestReceipt.upsert({
      where: {
        deviceId_sequenceNumber: {
          deviceId: payload.deviceKey,
          sequenceNumber: payload.sequenceNumber
        }
      },
      create: {
        deviceId: payload.deviceKey,
        sequenceNumber: payload.sequenceNumber,
        readingId: reading.id,
        ...(payload.messageId ? { messageId: payload.messageId } : {})
      },
      update: {
        readingId: reading.id,
        ...(payload.messageId ? { messageId: payload.messageId } : {})
      }
    });
  }

  const nodeUpdateData: Prisma.EdgeNodeUpdateInput = {
    status: NodeStatus.online,
    healthState: "online",
    lastSeen: deviceTimestamp,
    lastSuccessfulIngestAt: ingestedAt
  };
  if (typeof payload.batteryLevel === "number") {
    nodeUpdateData.batteryLevel = payload.batteryLevel;
  }
  if (typeof payload.signalStrength === "number") {
    nodeUpdateData.signalStrength = payload.signalStrength;
  }
  if (typeof payload.firmwareVersion === "string") {
    nodeUpdateData.firmwareVersion = payload.firmwareVersion;
  }
  if (typeof payload.queueDepth === "number") {
    nodeUpdateData.queueDepth = payload.queueDepth;
  }
  if (typeof payload.watchdogResetCount === "number") {
    nodeUpdateData.watchdogResetCount = payload.watchdogResetCount;
  }
  if (typeof payload.restartCount === "number") {
    nodeUpdateData.restartCount = payload.restartCount;
  }
  if (typeof payload.lastResetReason === "string") {
    nodeUpdateData.lastResetReason = payload.lastResetReason;
  }
  if (typeof payload.appliedConfigVersion === "string") {
    nodeUpdateData.appliedConfigVersion = payload.appliedConfigVersion;
  }
  if (typeof payload.enclosureTemperatureC === "number") {
    nodeUpdateData.enclosureTemperatureC = payload.enclosureTemperatureC;
  }
  if (typeof payload.storageUtilisationPct === "number") {
    nodeUpdateData.storageUtilisationPct = payload.storageUtilisationPct;
  }
  if (typeof payload.location === "string") {
    nodeUpdateData.location = payload.location;
  }
  if (typeof payload.latitude === "number") {
    nodeUpdateData.latitude = payload.latitude;
  }
  if (typeof payload.longitude === "number") {
    nodeUpdateData.longitude = payload.longitude;
  }

  const updatedNode = await prisma.edgeNode.update({
    where: { id: node.id },
    data: nodeUpdateData,
    select: {
      id: true,
      serialNumber: true,
      name: true,
      location: true,
      status: true,
      firmwareVersion: true,
      batteryLevel: true,
      signalStrength: true,
      lastSeen: true,
      createdAt: true,
      siteId: true
    }
  });

  if (node.status !== NodeStatus.online) {
    await createStatusLog({
      nodeId: node.id,
      fromStatus: node.status,
      toStatus: NodeStatus.online,
      action: "node.ingestion.online",
      message: "Node reported telemetry and was marked online"
    });
  }

  return {
    reading,
    nodeStatus: updatedNode,
    isNewNode
  } satisfies IngestionResult;
};

export const ingestEdgeData = async (
  payload: EdgeDataBody,
  deviceKey?: string,
  auth?: EdgeIngestAuthContext
): Promise<IngestionEnvelope> => {
  const sequenceNumber =
    typeof auth?.sequenceNumber === "number"
      ? auth.sequenceNumber
      : typeof payload.sequenceNumber === "number"
        ? payload.sequenceNumber
        : undefined;

  // Idempotent ACK: same deviceId + sequenceNumber already accepted.
  if (auth?.idempotentReplay && deviceKey && typeof sequenceNumber === "number") {
    const receipt = await prisma.edgeIngestReceipt.findUnique({
      where: {
        deviceId_sequenceNumber: { deviceId: deviceKey, sequenceNumber }
      }
    });
    if (receipt?.readingId) {
      const existing = await prisma.sensorReading.findUnique({ where: { id: receipt.readingId } });
      if (existing) {
        return {
          message: "Duplicate sequence acknowledged.",
          data: existing,
          idempotent: true,
          acknowledgedSequence: sequenceNumber
        };
      }
    }
    // Watermark advanced previously but receipt missing (legacy) — still ACK success.
    return {
      message: "Duplicate sequence acknowledged.",
      data: {
        id: receipt?.id ?? `ack-${deviceKey}-${sequenceNumber}`,
        nodeId: "",
        voltage: payload.voltage,
        current: payload.current,
        power: payload.power,
        sequenceNumber
      } as IngestionResult["reading"],
      idempotent: true,
      acknowledgedSequence: sequenceNumber
    };
  }

  const readingInput = {
    deviceKey,
    voltage: payload.voltage,
    current: payload.current,
    power: payload.power
  } as CreateReadingInput;

  if (payload.nodeId) {
    readingInput.nodeId = payload.nodeId;
  }
  if (typeof sequenceNumber === "number") {
    readingInput.sequenceNumber = sequenceNumber;
  }
  if (typeof payload.messageId === "string") {
    readingInput.messageId = payload.messageId;
  }
  if (typeof payload.energyToday === "number") {
    readingInput.energyToday = payload.energyToday;
  }
  if (typeof payload.inverterPower === "number") {
    readingInput.inverterPower = payload.inverterPower;
  }
  if (typeof payload.curtailment === "number") {
    readingInput.curtailment = payload.curtailment;
  }
  if (typeof payload.batteryLevel === "number") {
    readingInput.batteryLevel = payload.batteryLevel;
  }
  if (typeof payload.signalStrength === "number") {
    readingInput.signalStrength = payload.signalStrength;
  }
  if (typeof payload.firmwareVersion === "string") {
    readingInput.firmwareVersion = payload.firmwareVersion;
  }
  if (typeof payload.location === "string") {
    readingInput.location = payload.location;
  }
  if (typeof payload.latitude === "number") {
    readingInput.latitude = payload.latitude;
  }
  if (typeof payload.longitude === "number") {
    readingInput.longitude = payload.longitude;
  }
  if (payload.timestamp) {
    readingInput.timestamp = new Date(payload.timestamp);
  }
  if (typeof payload.queueDepth === "number") {
    readingInput.queueDepth = payload.queueDepth;
  }
  if (typeof payload.watchdogResetCount === "number") {
    readingInput.watchdogResetCount = payload.watchdogResetCount;
  }
  if (typeof payload.restartCount === "number") {
    readingInput.restartCount = payload.restartCount;
  }
  if (typeof payload.lastResetReason === "string") {
    readingInput.lastResetReason = payload.lastResetReason;
  }
  if (typeof payload.appliedConfigVersion === "string") {
    readingInput.appliedConfigVersion = payload.appliedConfigVersion;
  }
  if (typeof payload.enclosureTemperatureC === "number") {
    readingInput.enclosureTemperatureC = payload.enclosureTemperatureC;
  }
  if (typeof payload.storageUtilisationPct === "number") {
    readingInput.storageUtilisationPct = payload.storageUtilisationPct;
  }

  const result = await createReading(readingInput);
  if (!result.idempotent) {
    const io = getSocketServer();
    const siteId =
      result.nodeStatus && "siteId" in result.nodeStatus
        ? (result.nodeStatus as { siteId?: string }).siteId
        : undefined;
    emitToSiteScope(io, LIVE_READING_EVENT, result.reading, { siteId: siteId ?? null });
    emitToSiteScope(io, NODE_STATUS_UPDATE_EVENT, result.nodeStatus, { siteId: siteId ?? null });
    if (result.isNewNode) {
      emitToSiteScope(io, NEW_NODE_EVENT, result.nodeStatus, { siteId: siteId ?? null });
    }
  }

  return {
    message: result.idempotent ? "Duplicate sequence acknowledged." : "Reading ingested successfully.",
    data: result.reading as IngestionEnvelope["data"],
    ...(result.idempotent ? { idempotent: true as const } : {}),
    ...(typeof sequenceNumber === "number" ? { acknowledgedSequence: sequenceNumber } : {})
  } as IngestionEnvelope;
};
