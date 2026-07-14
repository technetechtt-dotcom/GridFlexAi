import { NodeStatus, Prisma } from "@prisma/client";

import { LIVE_READING_EVENT, NEW_NODE_EVENT, NODE_STATUS_UPDATE_EVENT } from "../config/constants.js";
import { getSocketServer } from "../config/socket.js";
import { prisma } from "../lib/prisma.js";
import type { EdgeDataBody } from "../schemas/request.schemas.js";
import { AppError } from "../utils/AppError.js";
import { createStatusLog, resolveNodeForIngestion } from "./node.service.js";

type ReadingFilters = {
  nodeId?: string;
  page: number;
  pageSize: number;
  sort: "asc" | "desc";
  startDate?: Date;
  endDate?: Date;
  windowHours?: number;
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

export const getReadings = async ({ nodeId, page, pageSize, sort, startDate, endDate, windowHours }: ReadingFilters) => {
  const where: Prisma.SensorReadingWhereInput = {};

  if (nodeId) {
    where.nodeId = nodeId;
  }

  const timestampRange = buildTimestampRange({
    startDate,
    endDate,
    windowHours
  });
  if (timestampRange) {
    where.timestamp = timestampRange;
  }

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

export const getReadingsSummary = async ({ nodeId, startDate, endDate }: ReadingSummaryFilters) => {
  const where: Prisma.SensorReadingWhereInput = {};
  if (nodeId) {
    where.nodeId = nodeId;
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
  reading: Awaited<ReturnType<typeof prisma.sensorReading.create>>;
  nodeStatus: {
    id: string;
    name: string;
    location: string;
    status: NodeStatus;
    lastSeen: Date | null;
    createdAt: Date;
  };
  isNewNode: boolean;
};

type IngestionEnvelope = {
  message: string;
  data: IngestionResult["reading"];
};

export const createReading = async (payload: CreateReadingInput) => {
  const { node, isNewNode } = await resolveNodeForIngestion(payload.nodeId, payload.deviceKey);

  const readingData: Prisma.SensorReadingUncheckedCreateInput = {
    nodeId: node.id,
    voltage: payload.voltage,
    current: payload.current,
    power: payload.power,
    timestamp: payload.timestamp ?? new Date()
  };

  if (typeof payload.energyToday === "number") {
    readingData.energyToday = payload.energyToday;
  }
  if (typeof payload.inverterPower === "number") {
    readingData.inverterPower = payload.inverterPower;
  }
  if (typeof payload.curtailment === "number") {
    readingData.curtailment = payload.curtailment;
  }

  const reading = await prisma.sensorReading.create({
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

  const nodeUpdateData: Prisma.EdgeNodeUpdateInput = {
    status: NodeStatus.online,
    lastSeen: reading.timestamp
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
      createdAt: true
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

export const ingestEdgeData = async (payload: EdgeDataBody, deviceKey?: string): Promise<IngestionEnvelope> => {
  const readingInput = {
    deviceKey,
    voltage: payload.voltage,
    current: payload.current,
    power: payload.power
  } as CreateReadingInput;

  if (payload.nodeId) {
    readingInput.nodeId = payload.nodeId;
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

  const result = await createReading(readingInput);
  const io = getSocketServer();
  io.emit(LIVE_READING_EVENT, result.reading);
  io.emit(NODE_STATUS_UPDATE_EVENT, result.nodeStatus);
  if (result.isNewNode) {
    io.emit(NEW_NODE_EVENT, result.nodeStatus);
  }

  return {
    message: "Reading ingested successfully.",
    data: result.reading
  };
};
