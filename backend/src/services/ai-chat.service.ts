import { streamText, stepCountIs, tool } from "ai";
import { openai } from "@ai-sdk/openai";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import type { AiChatBody } from "../schemas/request.schemas.js";
import { getDashboardOverview } from "./dashboard.service.js";
import { getHybridForecast } from "./forecast.service.js";
import { listAlarmEvents } from "./alarm.service.js";
import {
  enforcePromptBoundaries, proposeCommandInputSchema, proposeCommandOnly, redactSecrets, resolveZoltAccessScope,
  wrapToolExecute, zoltPrepareStep, ZOLT_SYSTEM_SAFETY
} from "./zolt-hardening.js";
import { AppError } from "../utils/AppError.js";
import {
  assertNodeSiteAccess,
  getOptionalSiteAccessScope,
  type AccessActor
} from "./access-scope.service.js";

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

const resolveScopedNodes = async (targets: ScopedNodeTarget[], actor?: AccessActor) => {
  const scope = await getOptionalSiteAccessScope(actor);
  if (!targets.length && scope.kind === "global") {
    return [];
  }

  const ids = targets.map((target) => target.id).filter((value): value is string => Boolean(value));
  const names = targets.map((target) => target.name).filter(Boolean);
  const where: Prisma.EdgeNodeWhereInput = scope.kind === "site" ? { siteId: scope.siteId } : {};
  const targetMatchers: Prisma.EdgeNodeWhereInput[] = [];
  if (ids.length) {
    targetMatchers.push({ id: { in: ids } });
  }
  if (names.length) {
    targetMatchers.push({ name: { in: names } });
  }
  if (targetMatchers.length > 0) {
    where.OR = targetMatchers;
  }

  const nodes = await prisma.edgeNode.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    take: targets.length ? targets.length : 8,
    select: {
      id: true,
      name: true,
      location: true,
      latitude: true,
      longitude: true,
      status: true,
      lastSeen: true,
      readings: {
        orderBy: [{ timestamp: "desc" }],
        take: 1,
        select: {
          power: true
        }
      }
    }
  });

  const toResolvedNode = (
    matchedNode: (typeof nodes)[number],
    target?: ScopedNodeTarget
  ) => {
    const latestPower = matchedNode.readings[0]?.power;
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
      id: matchedNode.id,
      name: matchedNode.name,
      location: matchedNode.location,
      lat: matchedNode.latitude ?? target?.lat ?? null,
      lon: matchedNode.longitude ?? target?.lon ?? null,
      capacity: target?.capacity ?? (typeof latestPower === "number" ? Math.max(120, Math.round(latestPower * 1.25)) : 140),
      status: matchedNode.status,
      lastSeen: matchedNode.lastSeen
    };
    return resolvedNode;
  };

  if (scope.kind === "site") {
    if (!targets.length) {
      return nodes.map((node) => toResolvedNode(node));
    }

    return targets.flatMap((target) => {
      const matchedNode = nodes.find((node) => node.id === target.id || node.name === target.name);
      return matchedNode ? [toResolvedNode(matchedNode, target)] : [];
    });
  }

  return targets.map((target) => {
    const matchedNode = nodes.find((node) => node.id === target.id || node.name === target.name);
    if (matchedNode) {
      return toResolvedNode(matchedNode, target);
    }

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
      name: target.name,
      location: null,
      lat: target.lat ?? null,
      lon: target.lon ?? null,
      capacity: target.capacity ?? null,
      status: null,
      lastSeen: null
    };
    if (target.id) {
      resolvedNode.id = target.id;
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
  }>,
  lockForecastToScopedNodes: boolean
) => {
  const primaryScopedNode = scopedNodes[0];

  return {
    resolveNodeId(nodeId?: string) {
      return nodeId ?? primaryScopedNode?.id;
    },
    resolveForecastInput(input: { lat: number | undefined; lon: number | undefined; capacity: number | undefined }) {
      if (lockForecastToScopedNodes) {
        return {
          lat: primaryScopedNode?.lat ?? null,
          lon: primaryScopedNode?.lon ?? null,
          capacity: primaryScopedNode?.capacity ?? null
        };
      }

      return {
        lat: input.lat ?? primaryScopedNode?.lat ?? null,
        lon: input.lon ?? primaryScopedNode?.lon ?? null,
        capacity: input.capacity ?? primaryScopedNode?.capacity ?? null
      };
    },
    primaryScopedNode
  };
};

const getLiveReadings = async (nodeId: string, actor?: AccessActor) => {
  await assertNodeSiteAccess(nodeId, actor);

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

const getNodeStatus = async (actor?: AccessActor) => {
  const scope = await getOptionalSiteAccessScope(actor);

  const nodes = await prisma.edgeNode.findMany({
    where: scope.kind === "site" ? { siteId: scope.siteId } : {},
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

const analyzeCurtailment = async (nodeId: string | undefined, windowHours: number, actor?: AccessActor) => {
  if (nodeId) {
    await assertNodeSiteAccess(nodeId, actor);
  }

  const scope = await getOptionalSiteAccessScope(actor);
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);
  const where: Prisma.SensorReadingWhereInput = {
    timestamp: { gte: since },
    ...(nodeId ? { nodeId } : {})
  };
  if (scope.kind === "site") {
    where.node = {
      is: {
        siteId: scope.siteId
      }
    };
  }

  const readings = await prisma.sensorReading.findMany({
    where,
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

export const getAiStreamErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  if (typeof error === "object" && error !== null) {
    const nested = error as {
      message?: unknown;
      error?: { message?: unknown; code?: unknown };
    };

    if (typeof nested.error?.message === "string" && nested.error.message.trim()) {
      return nested.error.message.trim();
    }

    if (typeof nested.message === "string" && nested.message.trim()) {
      return nested.message.trim();
    }
  }

  return "Zolt AI could not complete the request.";
};

export const generateAiChatResponse = async (input: AiChatBody, actor?: AccessActor) => {
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

  const rawPrompt = input.context ?
    `Context:\n${redactSecrets(input.context)}\n\nUser request:\n${redactSecrets(latestMessageText)}` :
    redactSecrets(latestMessageText);

  const prompt = enforcePromptBoundaries(rawPrompt);

  const scopedTargets = parseScopedNodeTargets(input.context);
  const [scope, scopedNodes] = await Promise.all([
    getOptionalSiteAccessScope(actor),
    resolveScopedNodes(scopedTargets, actor)
  ]);
  const scopedResolvers = createScopedResolvers(scopedNodes, scope.kind === "site");
  const scopedSystemHint = scopedNodes.length ?
    `Prioritize these scoped nodes first unless the user explicitly asks for a different target: ${
      scopedNodes.map((node) => `${node.name}${node.id ? ` [${node.id}]` : ""}`).join(", ")
    }.` :
    "No scoped nodes were provided; choose the best tool target from the request.";

  const userId = actor?.id ?? "anonymous";

  return streamText({
    model: openai(env.OPENAI_MODEL),
    stopWhen: stepCountIs(5),
    prepareStep: zoltPrepareStep,
    system: `${ZOLT_SYSTEM_SAFETY} Use concise, practical language and call out uncertainty when data is partial. ${scopedSystemHint}`,
    prompt,
    tools: {
      getLiveReadings: tool({ description: "Get latest voltage/current/power readings for a node.", inputSchema: toolSchemas.getLiveReadings,
        execute: wrapToolExecute("getLiveReadings", userId, async ({ nodeId }) => {
          const resolvedNodeId = scopedResolvers.resolveNodeId(nodeId);
          if (!resolvedNodeId) throw new AppError("No nodeId provided and no scoped node was available in chat context.", 400);
          return getLiveReadings(resolvedNodeId, actor);
        })
      }),
      getForecast: tool({ description: "Get hybrid forecast for coordinates and capacity.", inputSchema: toolSchemas.getForecast,
        execute: wrapToolExecute("getForecast", userId, async ({ lat, lon, capacity }) => {
          const resolved = scopedResolvers.resolveForecastInput({ lat, lon, capacity });
          if (resolved.lat === null || resolved.lon === null || resolved.capacity === null) throw new AppError("Forecast target is incomplete.", 400);
          const forecast = await getHybridForecast({ lat: resolved.lat, lon: resolved.lon, capacity: resolved.capacity });
          return { meta: forecast.meta, hourly: forecast.hourly.slice(0, 24), daily: forecast.daily, scopedNode: scopedResolvers.primaryScopedNode ?? null };
        })
      }),
      getNodeStatus: tool({ description: "Get node online/offline status with last seen timestamps.", inputSchema: toolSchemas.getNodeStatus,
        execute: wrapToolExecute("getNodeStatus", userId, async () => getNodeStatus(actor))
      }),
      getDailySummary: tool({ description: "Get dashboard daily summary of current fleet metrics.", inputSchema: toolSchemas.getDailySummary,
        execute: wrapToolExecute("getDailySummary", userId, async () => getDashboardOverview(actor))
      }),
      analyzeCurtailment: tool({ description: "Analyze curtailment trend and estimated energy impact over a time window.", inputSchema: toolSchemas.analyzeCurtailment,
        execute: wrapToolExecute("analyzeCurtailment", userId, async ({ nodeId, windowHours }) => analyzeCurtailment(scopedResolvers.resolveNodeId(nodeId), windowHours, actor))
      }),
      getAlarms: tool({ description: "List active or recent alarm events for the operator scope.", inputSchema: z.object({ status: z.enum(["active", "acknowledged", "cleared", "suppressed"]).optional(), siteId: z.string().optional() }),
        execute: wrapToolExecute("getAlarms", userId, async ({ status, siteId }) => {
          if (!actor?.id) throw new AppError("Authentication required for alarm lookup.", 401);
          return listAlarmEvents({ id: actor.id, role: actor.role }, { status, siteId });
        })
      }),
      proposeCommand: tool({ description: "Propose a plant command for operator review. Never executes physical actions.", inputSchema: proposeCommandInputSchema,
        execute: wrapToolExecute("proposeCommand", userId, async (commandInput) => {
          if (!actor?.id) throw new AppError("Authentication required for command proposals.", 401);
          const accessScope = await resolveZoltAccessScope(actor.id, actor.role as import("@prisma/client").Role);
          return proposeCommandOnly(commandInput, { id: actor.id }, accessScope);
        })
      })
    }
  });
};
