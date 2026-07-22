import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { logger } from "../utils/logger.js";
import { buildProvenance } from "../domain/operating-mode.js";
import { emitSimulationReading } from "./socket-namespace.js";

type SimState = {
  powerKw: number;
  voltage: number;
  demandKw: number;
};

let timer: ReturnType<typeof setInterval> | null = null;
const states = new Map<string, SimState>();

const walk = (value: number, amplitude: number, min: number, max: number): number => {
  const next = value + (Math.random() - 0.5) * amplitude;
  return Math.min(max, Math.max(min, next));
};

/**
 * Backend-owned simulation publisher.
 * Writes SensorReading rows with environment=simulation and emits on /simulation only.
 * Must never call the live Socket.IO default namespace.
 */
export const publishSimulationTick = async (): Promise<void> => {
  if (env.GRIDFLEX_OPERATING_MODE !== "SIMULATION") {
    return;
  }

  const runs = await prisma.simulationRun.findMany({
    where: {
      status: "running",
      targetNode: { isActive: true }
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      organisationId: true,
      siteId: true,
      targetNode: {
        select: { id: true, name: true, location: true, status: true }
      }
    }
  });

  if (runs.length === 0) {
    return;
  }

  const activeRunIds = new Set(runs.map((run) => run.id));
  for (const runId of states.keys()) {
    if (!activeRunIds.has(runId)) states.delete(runId);
  }

  await Promise.all(runs.map(async (run) => {
    const state = states.get(run.id) ?? {
      powerKw: 850,
      voltage: 132,
      demandKw: 820
    };
    states.set(run.id, state);
    state.powerKw = walk(state.powerKw, 12, 400, 1200);
    state.voltage = walk(state.voltage, 1.5, 128, 136);
    state.demandKw = walk(state.demandKw, 15, 350, 1150);
    const current = state.powerKw / Math.max(state.voltage, 1);
    const now = new Date();

    const reading = await prisma.sensorReading.create({
      data: {
        nodeId: run.targetNode.id,
        voltage: Number(state.voltage.toFixed(2)),
        current: Number(current.toFixed(3)),
        power: Number(state.powerKw.toFixed(2)),
        timestamp: now,
        deviceTimestamp: now,
        ingestedAt: now,
        schemaVersion: "sim-1",
        sourceType: "simulated",
        quality: "unverified",
        environment: "simulation",
        simulationRunId: run.id,
        powerUnit: "kW",
        voltageUnit: "V",
        currentUnit: "A"
      },
      include: {
        node: {
          select: { id: true, name: true, location: true, status: true }
        }
      }
    });

    const provenance = buildProvenance({
      sourceType: "simulated",
      sourceId: run.id,
      quality: "unverified",
      measuredAt: now,
      receivedAt: now,
      unit: "kW"
    });

    emitSimulationReading({
      id: reading.id,
      nodeId: reading.nodeId,
      voltage: reading.voltage,
      current: reading.current,
      power: reading.power,
      timestamp: reading.timestamp.toISOString(),
      environment: "simulation",
      simulationRunId: run.id,
      provenance,
      node: reading.node
    }, {
      siteId: run.siteId,
      organisationId: run.organisationId
    });
  }));
};

export const startSimulationPublisher = (): void => {
  if (env.GRIDFLEX_OPERATING_MODE !== "SIMULATION") {
    logger.info("Simulation publisher idle.", { mode: env.GRIDFLEX_OPERATING_MODE });
    return;
  }
  if (timer) {
    return;
  }
  logger.info("Starting simulation telemetry publisher.", {
    intervalMs: env.SIMULATION_TELEMETRY_INTERVAL_MS,
    namespace: "/simulation"
  });
  void publishSimulationTick();
  timer = setInterval(() => {
    void publishSimulationTick().catch((error) => {
      logger.info("Simulation tick failed.", {
        error: error instanceof Error ? error.message : String(error)
      });
    });
  }, env.SIMULATION_TELEMETRY_INTERVAL_MS);
};

export const stopSimulationPublisher = (): void => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  states.clear();
};
