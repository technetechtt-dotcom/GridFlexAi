/**
 * Fail-closed edge replay when Redis is required but unavailable.
 * Complements scripts/redis-loss-recovery-drill.mjs (live chaos).
 */

const snapshotEnv = (): NodeJS.ProcessEnv => ({ ...process.env });

const restoreEnv = (saved: NodeJS.ProcessEnv): void => {
  for (const key of Object.keys(process.env)) {
    if (!(key in saved)) {
      delete process.env[key];
    }
  }
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
};

describe("edge replay fail-closed", () => {
  let savedEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    savedEnv = snapshotEnv();
    jest.resetModules();
    process.env.NODE_ENV = "test";
    process.env.EDGE_REPLAY_REQUIRE_REDIS = "true";
    process.env.EDGE_ALLOW_MEMORY_REPLAY = "false";
    process.env.REDIS_URL = "redis://127.0.0.1:6399";
  });

  afterEach(() => {
    restoreEnv(savedEnv);
    jest.resetModules();
    jest.dontMock("../src/lib/redis.js");
  });

  it("rejects ingest when Redis client is unavailable and replay is required", async () => {
    jest.doMock("../src/lib/redis.js", () => ({
      getRedisClient: () => null,
      closeRedisClient: async () => undefined
    }));

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { assertAndStoreEdgeNonce } = require("../src/lib/edge-replay.js") as typeof import("../src/lib/edge-replay.js");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { AppError } = require("../src/utils/AppError.js") as typeof import("../src/utils/AppError.js");

    await expect(assertAndStoreEdgeNonce("device-a", "nonce-1")).rejects.toMatchObject({
      statusCode: 503,
      message: expect.stringMatching(/Replay protection unavailable/i)
    });
    await expect(assertAndStoreEdgeNonce("device-a", "nonce-1")).rejects.toBeInstanceOf(AppError);
  });

  it("rejects ingest when Redis set throws and replay is required", async () => {
    jest.doMock("../src/lib/redis.js", () => ({
      getRedisClient: () => ({
        status: "ready",
        connect: async () => undefined,
        set: async () => {
          throw new Error("ECONNREFUSED");
        }
      }),
      closeRedisClient: async () => undefined
    }));

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { assertAndStoreEdgeNonce } = require("../src/lib/edge-replay.js") as typeof import("../src/lib/edge-replay.js");

    await expect(assertAndStoreEdgeNonce("device-b", "nonce-2")).rejects.toMatchObject({
      statusCode: 503
    });
  });
});
