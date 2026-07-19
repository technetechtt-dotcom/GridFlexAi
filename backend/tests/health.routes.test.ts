import request from "supertest";
jest.mock("../src/lib/prisma.js", () => ({ prisma: { $queryRaw: jest.fn().mockResolvedValue([{ one: 1 }]) } }));
import { createApp } from "../src/app.js";
describe("Health route", () => {
  const app = createApp();
  it("returns liveness payload without dependency checks", async () => {
    const response = await request(app).get("/api/health/live");
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
  });
  it("returns service status payload", async () => {
    const response = await request(app).get("/api/health");
    expect(response.status).toBe(200);
    expect(response.body.dependencies?.database).toBe("up");
  });
  it("returns readiness payload with safety flags", async () => {
    const response = await request(app).get("/api/health/ready");
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ready");
    expect(response.body.physicalCommandExecutionEnabled).toBe(false);
  });
});
