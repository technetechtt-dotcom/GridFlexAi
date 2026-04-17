import request from "supertest";

import { createApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { clearEdgeReplayCache } from "../src/middleware/edgeDeviceAuth.js";
import { ingestEdgeData } from "../src/services/reading.service.js";
import { createEdgeSignature } from "../src/utils/edgeDeviceAuth.js";

jest.mock("../src/services/reading.service.js", () => ({
  ingestEdgeData: jest.fn(),
  getReadings: jest.fn(),
  getReadingsSummary: jest.fn()
}));

const mockedIngestEdgeData = ingestEdgeData as jest.MockedFunction<typeof ingestEdgeData>;

const signHeaders = (payload: Record<string, unknown>, nonce = `nonce-${Date.now()}`) => {
  const timestamp = String(Date.now());
  const deviceId = "esp32-node-1";
  const signature = createEdgeSignature(
    {
      deviceId,
      timestamp,
      nonce,
      payload
    },
    env.EDGE_INGEST_SHARED_SECRET
  );
  return {
    "x-gridflex-device-id": deviceId,
    "x-gridflex-timestamp": timestamp,
    "x-gridflex-nonce": nonce,
    "x-gridflex-signature": signature
  };
};

describe("POST /api/edge-data", () => {
  const app = createApp();

  beforeEach(() => {
    jest.clearAllMocks();
    clearEdgeReplayCache();
  });

  it("ingests edge reading and broadcasts socket event", async () => {
    const payload = {
      nodeId: "node-1",
      voltage: 640,
      current: 11.2,
      power: 7.16
    };

    mockedIngestEdgeData.mockResolvedValue({
      message: "Reading ingested successfully.",
      data: {
        id: "reading-1",
        nodeId: "node-1",
        voltage: 640,
        current: 11.2,
        power: 7.16,
        energyToday: 31.4,
        inverterPower: 6.8,
        curtailment: 0.2,
        timestamp: new Date(),
        node: {
          id: "node-1",
          name: "Upington Node",
          location: "Upington",
          status: "online"
        }
      }
    });

    const res = await request(app)
    .post("/api/edge-data")
    .set(signHeaders(payload))
    .send(payload);

    expect(res.status).toBe(201);
    expect(mockedIngestEdgeData).toHaveBeenCalledTimes(1);
  });

  it("rejects request without signature headers", async () => {
    const res = await request(app)
    .post("/api/edge-data")
    .send({
      voltage: 640,
      current: 10
    });

    expect(res.status).toBe(401);
    expect(mockedIngestEdgeData).not.toHaveBeenCalled();
  });

  it("rejects request with invalid signature", async () => {
    const payload = {
      nodeId: "node-1",
      voltage: 640,
      current: 11.2,
      power: 7.16
    };
    const headers = signHeaders(payload);

    const res = await request(app)
    .post("/api/edge-data")
    .set({
      ...headers,
      "x-gridflex-signature": "deadbeef"
    })
    .send(payload);

    expect(res.status).toBe(401);
    expect(mockedIngestEdgeData).not.toHaveBeenCalled();
  });

  it("blocks replayed nonce requests", async () => {
    const payload = {
      nodeId: "node-1",
      voltage: 640,
      current: 11.2,
      power: 7.16
    };
    const headers = signHeaders(payload, "reused-nonce");

    mockedIngestEdgeData.mockResolvedValue({
      message: "Reading ingested successfully.",
      data: {
        id: "reading-1",
        nodeId: "node-1",
        voltage: 640,
        current: 11.2,
        power: 7.16,
        energyToday: null,
        inverterPower: null,
        curtailment: null,
        timestamp: new Date(),
        node: {
          id: "node-1",
          name: "Upington Node",
          location: "Upington",
          status: "online"
        }
      }
    });

    const first = await request(app).post("/api/edge-data").set(headers).send(payload);
    const second = await request(app).post("/api/edge-data").set(headers).send(payload);

    expect(first.status).toBe(201);
    expect(second.status).toBe(409);
  });

  it("rejects invalid edge payload after signature verification", async () => {
    const payload = {
      voltage: "bad",
      current: 10
    };
    const res = await request(app)
    .post("/api/edge-data")
    .set(signHeaders(payload, "payload-invalid"))
    .send(payload);

    expect(res.status).toBe(400);
    expect(mockedIngestEdgeData).not.toHaveBeenCalled();
  });
});
