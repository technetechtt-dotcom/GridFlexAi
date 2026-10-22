import request from "supertest";

jest.mock("../src/lib/prisma.js", () => ({
  prisma: {
    $queryRaw: jest.fn().mockResolvedValue([{ one: 1 }])
  }
}));

import { createApp } from "../src/app.js";
import { env } from "../src/config/env.js";

/** CI may inject GITHUB_SHA → RELEASE_GIT_SHA; digest stays unset in unit tests. */
const expectReleaseIdentity = (release: { gitSha: unknown; imageDigest: unknown }) => {
  expect(release.imageDigest).toBeNull();
  expect(release.gitSha === null || typeof release.gitSha === "string").toBe(true);
};

describe("Health route", () => {
  const app = createApp();

  it("returns liveness payload without dependency checks", async () => {
    const response = await request(app).get("/api/health/live");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(typeof response.body.uptime).toBe("number");
    expect(typeof response.body.timestamp).toBe("string");
    expectReleaseIdentity(response.body.release);
  });

  it("returns service status payload", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(typeof response.body.uptime).toBe("number");
    expect(typeof response.body.timestamp).toBe("string");
    expectReleaseIdentity(response.body.release);
    expect(response.body.dependencies?.database).toBe("up");
    expect(response.body.safety).toMatchObject({ pilotLockPhysicalExecution: true, physicalCommandExecutionEnabled: false });
  });

  it("fails readiness when mandatory Redis is unavailable", async () => {
    const original = env.EDGE_REPLAY_REQUIRE_REDIS;
    env.EDGE_REPLAY_REQUIRE_REDIS = true;
    try {
      expect((await request(app).get("/api/health")).status).toBe(503);
      expect((await request(app).get("/api/health/live")).status).toBe(200);
    } finally { env.EDGE_REPLAY_REQUIRE_REDIS = original; }
  });

  it("keeps probes available after the client API quota is exhausted", async () => {
    const limitedApp = createApp();
    for (let index = 0; index < 301; index += 1) {
      await request(limitedApp).get("/api/nodes");
    }
    expect((await request(limitedApp).get("/api/nodes")).status).toBe(429);
    expect((await request(limitedApp).get("/api/health/live")).status).toBe(200);
    expect((await request(limitedApp).get("/api/health")).status).toBe(200);
  });
});
