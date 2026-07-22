const simulationRunFindMany = jest.fn();
const sensorReadingCreate = jest.fn();
const emitSimulationReading = jest.fn();

jest.mock("../src/lib/prisma.js", () => ({
  prisma: {
    simulationRun: { findMany: simulationRunFindMany },
    sensorReading: { create: sensorReadingCreate }
  }
}));

jest.mock("../src/simulation/socket-namespace.js", () => ({
  emitSimulationReading
}));

import { publishSimulationTick, stopSimulationPublisher } from "../src/simulation/publisher.js";

describe("simulation publisher targeting", () => {
  afterEach(() => {
    stopSimulationPublisher();
    jest.clearAllMocks();
  });

  it("publishes only persisted running-run targets into tenant scope", async () => {
    simulationRunFindMany.mockResolvedValue([{
      id: "run-a",
      organisationId: "org-a",
      siteId: "site-a",
      targetNode: {
        id: "node-a",
        name: "Node A",
        location: "Site A",
        status: "online"
      }
    }]);
    sensorReadingCreate.mockImplementation(async ({ data }: {
      data: { nodeId: string; simulationRunId: string; power: number; voltage: number; current: number; timestamp: Date };
    }) => ({
      id: "reading-a",
      ...data,
      node: {
        id: "node-a",
        name: "Node A",
        location: "Site A",
        status: "online"
      }
    }));

    await publishSimulationTick();

    expect(simulationRunFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        status: "running",
        targetNode: { isActive: true }
      }
    }));
    expect(sensorReadingCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        nodeId: "node-a",
        simulationRunId: "run-a",
        environment: "simulation"
      })
    }));
    expect(emitSimulationReading).toHaveBeenCalledWith(
      expect.objectContaining({
        nodeId: "node-a",
        simulationRunId: "run-a"
      }),
      { siteId: "site-a", organisationId: "org-a" }
    );
  });
});
