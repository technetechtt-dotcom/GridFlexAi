jest.mock("../src/lib/prisma.js", () => ({ prisma: {
  edgeNode: { count: jest.fn() },
  sensorReading: { findMany: jest.fn() }
} }));
jest.mock("../src/services/forecast.service.js", () => ({ getForecastProvidersStatus: jest.fn() }));
jest.mock("../src/config/env.js", () => ({ defaultTelemetryEnvironmentFilter: () => "live" }));

import { prisma } from "../src/lib/prisma.js";
import { getDashboardOverview } from "../src/services/dashboard.service.js";

describe("current fleet power", () => {
  it("sums fresh node snapshots instead of presenting a historical mean as fleet generation", async () => {
    (prisma.edgeNode.count as jest.Mock).mockResolvedValue(2);
    const now = new Date();
    (prisma.sensorReading.findMany as jest.Mock)
      .mockResolvedValueOnce([{ voltage: 400, current: 10, power: 100, inverterPower: 90, curtailment: 0, timestamp: now }])
      .mockResolvedValueOnce([
        { nodeId: "a", power: 1000, inverterPower: 900, curtailment: 100, timestamp: now },
        { nodeId: "b", power: 2000, inverterPower: null, curtailment: null, timestamp: now }
      ]);
    const result = await getDashboardOverview({ id: "admin-1", role: "admin" });
    expect(result.averages.power).toBe(100);
    expect(result.currentPower).toMatchObject({ totalKw: 3000, inverterKw: 900, curtailmentKw: 100, nodesReporting: 2 });
    const snapshotQuery = (prisma.sensorReading.findMany as jest.Mock).mock.calls[1][0];
    expect(snapshotQuery.distinct).toEqual(["nodeId"]);
    expect(snapshotQuery.where).toMatchObject({ environment: "live", sourceType: { not: "simulated" }, node: { is: { isActive: true } } });
    expect(snapshotQuery.where.timestamp.lte.getTime() - snapshotQuery.where.timestamp.gte.getTime()).toBe(60_000);
  });

  it("returns no reporting nodes when the fresh snapshot is empty", async () => {
    (prisma.edgeNode.count as jest.Mock).mockResolvedValue(2);
    (prisma.sensorReading.findMany as jest.Mock).mockResolvedValue([]);
    const result = await getDashboardOverview({ id: "admin-1", role: "admin" });
    expect(result.currentPower).toMatchObject({ totalKw: 0, nodesReporting: 0 });
  });
});
