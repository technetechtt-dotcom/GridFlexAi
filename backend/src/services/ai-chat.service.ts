import { streamText, stepCountIs, tool } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import type { AiChatBody } from "../schemas/request.schemas.js";
import { getDashboardOverview } from "./dashboard.service.js";
import { getHybridForecast } from "./forecast.service.js";
import { AppError } from "../utils/AppError.js";

type CurtailmentStats = {
  nodeId: string;
  nodeName: string;
  avgCurtailmentKw: number;
};

type ScopedNodeTarget = {
  id?: string;
  name: string;
  lat?: number;
  lon?: number;
  capacity?: number;
};

const toolSchemas = {
  getLiveReadings: z.object({
    nodeId: z.string().optional()
  }),
  getForecast: z.object({
    lat: z.number().min(-90).max(90).optional(),
    lon: z.number().min(-180).max(180).optional(),
    capacity: z.number().positive().max(100000).optional()
  }),
  getNodeStatus: z.object({}),
  getDailySummary: z.object({}),
  analyzeCurtailment: z.object({
    nodeId: z.string().optional(),
    windowHours: z.number().int().min(1).max(24 * 30).default(24)
  })
};

const scopedProfilePattern =
  /(?<name>.+?)(?:\s+\[id:\s*(?<id>[^\]]+)\])?\s+\((?<lat>-?\d+(?:\.\d+)?),\s*(?<lon>-?\d+(?:\.\d+)?)\)\s+capacity\s+(?<capacity>\d+(?:\.\d+)?)kW/gi;

const parseScopedNodeTargets = (context: string | undefined): ScopedNodeTarget[] => {
  if (!context) {
    return [];
  }

  const scopedTargets: ScopedNodeTarget[] = [];
  for (const match of context.matchAll(scopedProfilePattern)) {
    const groups = match.groups;
    if (!groups?.name) continue;

    const nextTarget: ScopedNodeTarget = {
      name: groups.name.trim()
    };
    if (groups.id?.trim()) {
      nextTarget.id = groups.id.trim();
    }
    if (groups.lat) {
      nextTarget.lat = Number.parseFloat(groups.lat);
    }
    if (groups.lon) {
      nextTarget.lon = Number.parseFloat(groups.lon);
    }
    if (groups.capacity) {
      nextTarget.capacity = Number.parseFloat(groups.capacity);
    }
    scopedTargets.push(nextTarget);
  }

  return scopedTargets;
};

const resolveScopedNodes = async (targets: ScopedNodeTarget[]) => {
  if (!targets.length) {
    return [];
  }

  const ids = targets.map((target) => target.id).filter((value): value is string => Boolean(value));
  const names = targets.map((target) => target.name).filter(Boolean);
  const nodes = await prisma.edgeNode.findMany({
    where: {
      OR: [
        ids.length ? { id: { in: ids } } : undefined,
        names.length ? { name: { in: names } } : undefined
      ].filter(Boolean) as Array<Record<string, unknown>>
    },
    select: {
      id: true,
      name: true,
      location: true,
      latitude: true,
      longitude: true,
      status: true,
      lastSeen: true
    }
  });

  return targets.map((target) => {
    const matchedNode = nodes.find((node) => node.id === target.id || node.name === target.name);
    const resolvedNode: {
      id?: string;
      name: string;
      location: string | null;
      lat: number | null;
      lon: number | null;
      capacity: number | null;
      status: string | null;
      lastSeen: Date | null;
    } = {
      name: matchedNode?.name ?? target.name,
      location: matchedNode?.location ?? null,
      lat: matchedNode?.latitude ?? target.lat ?? null,
      lon: matchedNode?.longitude ?? target.lon ?? null,
      capacity: target.capacity ?? null,
      status: matchedNode?.status ?? null,
      lastSeen: matchedNode?.lastSeen ?? null
    };
    const resolvedId = matchedNode?.id ?? target.id;
    if (resolvedId) {
      resolvedNode.id = resolvedId;
    }
    return resolvedNode;
  });
};

const createScopedResolvers = (
  scopedNodes: Array<{
    id?: string;
    name: string;
    lat: number | null;
    lon: number | null;
    capacity: number | null;
  }>
) => {
  const primaryScopedNode = scopedNodes[0];

  return {
    resolveNodeId(nodeId?: string) {
      return nodeId ?? primaryScopedNode?.id;
    },
    resolveForecastInput(input: { lat: number | undefined; lon: number | undefined; capacity: number | undefined }) {
      return {
        lat: input.lat ?? primaryScopedNode?.lat ?? null,
        lon: input.lon ?? primaryScopedNode?.lon ?? null,
        capacity: input.capacity ?? primaryScopedNode?.capacity ?? null
      };
    },
    primaryScopedNode
  };
};

const getLiveReadings = async (nodeId: string) => {
  const readings = await prisma.sensorReading.findMany({
    where: { nodeId },
    orderBy: [{ timestamp: "desc" }],
    take: 10,
    select: {
      id: true,
      voltage: true,
      current: true,
      power: true,
      curtailment: true,
      inverterPower: true,
      timestamp: true
    }
  });

  const node = await prisma.edgeNode.findUnique({
    where: { id: nodeId },
    select: {
      id: true,
      name: true,
      location: true,
      status: true,
      lastSeen: true
    }
  });

  return {
    node,
    readings
  };
};

const getNodeStatus = async () => {
  const nodes = await prisma.edgeNode.findMany({
    orderBy: [{ createdAt: "desc" }],
    take: 50,
    select: {
      id: true,
      name: true,
      location: true,
      status: true,
      lastSeen: true,
      createdAt: true
    }
  });

  return {
    total: nodes.length,
    nodes
  };
};

const analyzeCurtailment = async (nodeId: string | undefined, windowHours: number) => {
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);
  const readings = await prisma.sensorReading.findMany({
    where: {
      timestamp: { gte: since },
      ...(nodeId ? { nodeId } : {})
    },
    orderBy: [{ timestamp: "asc" }],
    select: {
      nodeId: true,
      timestamp: true,
      curtailment: true,
      node: {
        select: {
          name: true
        }
      }
    }
  });

  const curtailmentValues = readings
    .map((row) => row.curtailment)
    .filter((value): value is number => typeof value === "number");
  const avgCurtailmentKw =
    curtailmentValues.length > 0 ?
      Number((curtailmentValues.reduce((acc, value) => acc + value, 0) / curtailmentValues.length).toFixed(2)) :
      0;
  const peakCurtailmentKw = curtailmentValues.length > 0 ? Number(Math.max(...curtailmentValues).toFixed(2)) : 0;

  let estimatedEnergyLostKwh = 0;
  for (let index = 1; index < readings.length; index += 1) {
    const current = readings[index];
    const previous = readings[index - 1];
    if (!current || !previous) continue;
    const currentCurtailment = current.curtailment ?? 0;
    const previousCurtailment = previous.curtailment ?? 0;
    const deltaHours = Math.max(0, Math.min((current.timestamp.getTime() - previous.timestamp.getTime()) / 3_600_000, 1));
    estimatedEnergyLostKwh += ((currentCurtailment + previousCurtailment) / 2) * deltaHours;
  }

  const statsByNode = new Map<string, { name: string; values: number[] }>();
  for (const row of readings) {
    const value = row.curtailment;
    if (typeof value !== "number") continue;
    const existing = statsByNode.get(row.nodeId) ?? { name: row.node.name, values: [] };
    existing.values.push(value);
    statsByNode.set(row.nodeId, existing);
  }

  const topNodesByCurtailment: CurtailmentStats[] = Array.from(statsByNode.entries())
    .map(([id, entry]) => ({
      nodeId: id,
      nodeName: entry.name,
      avgCurtailmentKw: Number((entry.values.reduce((acc, value) => acc + value, 0) / Math.max(entry.values.length, 1)).toFixed(2))
    }))
    .sort((a, b) => b.avgCurtailmentKw - a.avgCurtailmentKw)
    .slice(0, 5);

  return {
    windowHours,
    nodeId: nodeId ?? null,
    samples: readings.length,
    avgCurtailmentKw,
    peakCurtailmentKw,
    estimatedEnergyLostKwh: Number(estimatedEnergyLostKwh.toFixed(2)),
    topNodesByCurtailment
  };
};

export const generateAiChatResponse = async (input: AiChatBody) => {
  if (!env.OPENAI_API_KEY) {
    throw new AppError("OPENAI_API_KEY is not configured on the backend.", 503);
  }

  const latestMessageText = input.message?.trim() ??
    input.messages?.
      slice().
      reverse().
      map((message) => {
        if (typeof message.content === "string") {
          return message.content;
        }
        if (Array.isArray(message.parts)) {
          const textParts = message.parts
            .map((part) => {
              if (part && typeof part === "object" && "type" in part && (part as { type?: string }).type === "text") {
                const maybeText = (part as { text?: unknown }).text;
                return typeof maybeText === "string" ? maybeText : "";
              }
              return "";
            })
            .join("\n")
            .trim();
          if (textParts) return textParts;
        }
        return "";
      })
      .find((value) => value.length > 0) ??
    "";

  const prompt = input.context ?
    `Context:\n${input.context}\n\nUser request:\n${latestMessageText}` :
    latestMessageText;

  if (!prompt.trim()) {
    throw new AppError("A non-empty chat prompt is required.", 400);
  }

  const scopedTargets = parseScopedNodeTargets(input.context);
  const scopedNodes = await resolveScopedNodes(scopedTargets);
  const scopedResolvers = createScopedResolvers(scopedNodes);
  const scopedSystemHint = scopedNodes.length ?
    `Prioritize these scoped nodes first unless the user explicitly asks for a different target: ${
      scopedNodes.map((node) => `${node.name}${node.id ? ` [${node.id}]` : ""}`).join(", ")
    }.` :
    "No scoped nodes were provided; choose the best tool target from the request.";

  return streamText({
    model: openai(env.OPENAI_MODEL),
    stopWhen: stepCountIs(5),
    system:
      "You are Zolt AI, the GridFlex assistant for energy operations. Use available tools before giving operational conclusions. " +
      "Use concise, practical language and call out uncertainty when data is partial. " +
      scopedSystemHint,
    prompt,
    tools: {
      getLiveReadings: tool({
        description: "Get latest voltage/current/power readings for a node.",
        inputSchema: toolSchemas.getLiveReadings,
        execute: async ({ nodeId }) => {
          const resolvedNodeId = scopedResolvers.resolveNodeId(nodeId);
          if (!resolvedNodeId) {
            throw new AppError("No nodeId provided and no scoped node was available in chat context.", 400);
          }
          return getLiveReadings(resolvedNodeId);
        }
      }),
      getForecast: tool({
        description: "Get hybrid forecast for coordinates and capacity.",
        inputSchema: toolSchemas.getForecast,
        execute: async ({ lat, lon, capacity }) => {
          const resolved = scopedResolvers.resolveForecastInput({ lat, lon, capacity });
          if (resolved.lat === null || resolved.lon === null || resolved.capacity === null) {
            throw new AppError("Forecast target is incomplete. Provide coordinates/capacity or include scoped node context.", 400);
          }
          const forecast = await getHybridForecast({
            lat: resolved.lat,
            lon: resolved.lon,
            capacity: resolved.capacity
          });
          return {
            meta: forecast.meta,
            hourly: forecast.hourly.slice(0, 24),
            daily: forecast.daily,
            scopedNode: scopedResolvers.primaryScopedNode ?? null
          };
        }
      }),
      getNodeStatus: tool({
        description: "Get node online/offline status with last seen timestamps.",
        inputSchema: toolSchemas.getNodeStatus,
        execute: async () => getNodeStatus()
      }),
      getDailySummary: tool({
        description: "Get dashboard daily summary of current fleet metrics.",
        inputSchema: toolSchemas.getDailySummary,
        execute: async () => getDashboardOverview()
      }),
      analyzeCurtailment: tool({
        description: "Analyze curtailment trend and estimated energy impact over a time window.",
        inputSchema: toolSchemas.analyzeCurtailment,
        execute: async ({ nodeId, windowHours }) => analyzeCurtailment(scopedResolvers.resolveNodeId(nodeId), windowHours)
      })
    }
  });
};
