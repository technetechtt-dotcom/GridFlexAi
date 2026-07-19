import request from "supertest";

jest.mock("../src/middleware/auth.js", () => ({
  authenticate: (_req: unknown, _res: unknown, next: () => void) => next(),
  authorizeRoles: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  requireRoles: () => (_req: unknown, _res: unknown, next: () => void) => next()
}));

import { createApp } from "../src/app.js";
import { getReadings, getReadingsSummary } from "../src/services/reading.service.js";

jest.mock("../src/services/reading.service.js", () => ({
  ingestEdgeData: jest.fn(),
  getReadings: jest.fn(),
  getReadingsSummary: jest.fn()
}));

const mockedGetReadings = getReadings as jest.MockedFunction<typeof getReadings>;
const mockedGetReadingsSummary = getReadingsSummary as jest.MockedFunction<typeof getReadingsSummary>;

describe("Readings route contracts", () => {
  const app = createApp();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns paginated readings payload shape", async () => {
    mockedGetReadings.mockResolvedValue({
      items: [{
        id: "reading-1",
        nodeId: "node-1",
        voltage: 632.5,
        current: 11.1,
        power: 7.02,
        energyToday: 34.6,
        inverterPower: 6.9,
        curtailment: 0.1,
        timestamp: new Date("2026-04-17T08:00:00.000Z"),
        node: {
          id: "node-1",
          name: "Upington Node",
          location: "Upington",
          status: "online"
        }
      }],
      pagination: {
        page: 1,
        pageSize: 100,
        total: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false
      },
      filters: {
        nodeId: "node-1",
        startDate: "2026-04-17T00:00:00.000Z",
        endDate: "2026-04-17T23:59:59.999Z",
        sort: "desc"
      }
    } as Awaited<ReturnType<typeof getReadings>>);

    const res = await request(app)
    .get("/api/readings")
    .query({
      nodeId: "node-1",
      page: 1,
      pageSize: 100,
      sort: "desc"
    });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0].nodeId).toBe("node-1");
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.pageSize).toBe(100);
    expect(res.body.filters.sort).toBe("desc");
  });

  it("validates readings query constraints", async () => {
    const res = await request(app)
    .get("/api/readings")
    .query({
      pageSize: 999
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("Request validation failed");
    expect(mockedGetReadings).not.toHaveBeenCalled();
  });

  it("returns daily summary payload shape", async () => {
    mockedGetReadingsSummary.mockResolvedValue([
      {
        nodeId: "node-1",
        nodeName: "Upington Node",
        location: "Upington",
        date: "2026-04-17",
        totalEnergyKwh: 812.44,
        avgPowerKw: 121.31,
        samples: 288
      }
    ]);

    const res = await request(app)
    .get("/api/readings/summary")
    .query({
      nodeId: "node-1",
      startDate: "2026-04-17T00:00:00.000Z",
      endDate: "2026-04-17T23:59:59.999Z"
    });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0].date).toBe("2026-04-17");
    expect(res.body.data[0].samples).toBeGreaterThan(0);
  });
});
