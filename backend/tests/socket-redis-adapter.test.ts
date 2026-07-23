const connectFail = async () => {
  throw new Error("redis unavailable");
};

jest.mock("ioredis", () => {
  const client = {
    connect: connectFail,
    duplicate() {
      return {
        connect: connectFail,
        quit: async () => undefined,
        disconnect: () => undefined
      };
    },
    quit: async () => undefined,
    disconnect: () => undefined
  };
  return jest.fn(() => client);
});

jest.mock("../src/utils/logger.js", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe("socket redis adapter", () => {
  const loadAdapter = (nodeEnv: string, redisUrl?: string) => {
    jest.resetModules();
    jest.doMock("../src/config/env.js", () => ({
      env: {
        NODE_ENV: nodeEnv,
        REDIS_URL: redisUrl
      }
    }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("../src/lib/socket-redis-adapter.js") as typeof import("../src/lib/socket-redis-adapter.js");
  };

  it("fails closed in production when Redis connect fails", async () => {
    const { attachRedisSocketAdapter } = loadAdapter("production", "redis://localhost:6379");
    await expect(attachRedisSocketAdapter({ adapter: jest.fn() } as never)).rejects.toThrow(
      /Socket\.IO Redis adapter failed in production/
    );
  });

  it("fails closed in production when REDIS_URL is missing", async () => {
    const { attachRedisSocketAdapter } = loadAdapter("production", undefined);
    await expect(attachRedisSocketAdapter({ adapter: jest.fn() } as never)).rejects.toThrow(
      /REDIS_URL is required in production/
    );
  });

  it("continues with in-memory adapter outside production", async () => {
    const { attachRedisSocketAdapter } = loadAdapter("development", "redis://localhost:6379");
    await expect(attachRedisSocketAdapter({ adapter: jest.fn() } as never)).resolves.toBe(false);
  });
});
