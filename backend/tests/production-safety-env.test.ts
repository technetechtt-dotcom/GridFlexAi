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

const productionBaseline = (): Record<string, string> => ({
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/gridflex_prod",
  DIRECT_URL: "postgresql://postgres:postgres@localhost:5432/gridflex_prod",
  JWT_SECRET: "production-jwt-secret-with-32-characters-minimum",
  CORS_ORIGIN: "https://app.gridflex.example",
  ADMIN_REQUIRE_HTTPS: "true",
  EDGE_ALLOW_LEGACY_SHARED_SECRET: "false",
  EDGE_INGEST_SHARED_SECRET: "production-edge-secret-with-32-characters",
  REDIS_URL: "redis://localhost:6379",
  EDGE_REPLAY_REQUIRE_REDIS: "true",
  EDGE_ALLOW_MEMORY_REPLAY: "false",
  PHYSICAL_COMMAND_EXECUTION_ENABLED: "false",
  HIL_PLANT_APPROVAL_CONFIRMED: "false",
  DEVICE_SECRET_VAULT_PROVIDER: "aws_kms",
  AWS_KMS_KEY_ID: "arn:aws:kms:eu-west-1:123456789012:key/example",
  AWS_REGION: "eu-west-1",
  GRIDFLEX_OPERATING_MODE: "PILOT_LIVE",
  ALLOW_SIMULATION_IN_PRODUCTION: "false"
});

const loadEnvModule = () => {
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("../src/config/env.js") as typeof import("../src/config/env.js");
};

describe("production safety env", () => {
  let savedEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    savedEnv = snapshotEnv();
    jest.resetModules();
  });

  afterEach(() => {
    restoreEnv(savedEnv);
    jest.resetModules();
  });

  it("requires a direct database URL for production migrations", () => {
    Object.assign(process.env, productionBaseline());
    process.env.DIRECT_URL = "";

    expect(() => loadEnvModule()).toThrow(/DIRECT_URL is required/);
  });

  it("allows startup when both physical execution flags are false (pilot default)", () => {
    Object.assign(process.env, productionBaseline());
    const mod = loadEnvModule();
    expect(mod.isPhysicalCommandExecutionArmed()).toBe(false);
  });

  it("rejects startup when physical execution is enabled without HIL approval", () => {
    Object.assign(process.env, productionBaseline(), {
      PHYSICAL_COMMAND_EXECUTION_ENABLED: "true",
      HIL_PLANT_APPROVAL_CONFIRMED: "false"
    });
    expect(() => loadEnvModule()).toThrow(/HIL_PLANT_APPROVAL_CONFIRMED=true/);
  });

  it("rejects startup when HIL approval is set without physical execution enabled", () => {
    Object.assign(process.env, productionBaseline(), {
      PHYSICAL_COMMAND_EXECUTION_ENABLED: "false",
      HIL_PLANT_APPROVAL_CONFIRMED: "true"
    });
    expect(() => loadEnvModule()).toThrow(/PHYSICAL_COMMAND_EXECUTION_ENABLED=true/);
  });

  it("allows startup when both physical execution flags are true (post-HIL only)", () => {
    Object.assign(process.env, productionBaseline(), {
      PHYSICAL_COMMAND_EXECUTION_ENABLED: "true",
      HIL_PLANT_APPROVAL_CONFIRMED: "true",
      PILOT_LOCK_PHYSICAL_EXECUTION: "false"
    });
    const mod = loadEnvModule();
    expect(mod.isPhysicalCommandExecutionArmed()).toBe(true);
  });

  it("rejects arming while PILOT_LOCK_PHYSICAL_EXECUTION remains true", () => {
    Object.assign(process.env, productionBaseline(), {
      PHYSICAL_COMMAND_EXECUTION_ENABLED: "true",
      HIL_PLANT_APPROVAL_CONFIRMED: "true",
      PILOT_LOCK_PHYSICAL_EXECUTION: "true"
    });
    expect(() => loadEnvModule()).toThrow(/PILOT_LOCK_PHYSICAL_EXECUTION/);
  });

  it("rejects production startup when device secret vault is local", () => {
    Object.assign(process.env, productionBaseline(), {
      DEVICE_SECRET_VAULT_PROVIDER: "local",
      DEVICE_SECRET_VAULT_KEY: "dGVzdC1kZXZpY2Utc2VjcmV0LXZhdWx0LWtleS0zMiEh"
    });
    expect(() => loadEnvModule()).toThrow(/DEVICE_SECRET_VAULT_PROVIDER=local/);
  });

  it("rejects aws_kms in production without AWS_KMS_KEY_ID", () => {
    Object.assign(process.env, productionBaseline());
    delete process.env.AWS_KMS_KEY_ID;
    expect(() => loadEnvModule()).toThrow(/AWS_KMS_KEY_ID/);
  });

  it("allows aws_kms production startup with AWS_KMS_KEY_ID", () => {
    Object.assign(process.env, productionBaseline());
    const mod = loadEnvModule();
    expect(mod.env.DEVICE_SECRET_VAULT_PROVIDER).toBe("aws_kms");
    expect(mod.env.AWS_KMS_KEY_ID).toMatch(/key\//);
  });

  it("rejects production startup when memory replay is allowed", () => {
    Object.assign(process.env, productionBaseline(), {
      EDGE_ALLOW_MEMORY_REPLAY: "true"
    });
    expect(() => loadEnvModule()).toThrow(/EDGE_ALLOW_MEMORY_REPLAY must be false/);
  });

  it("rejects production startup when Redis replay is not required", () => {
    Object.assign(process.env, productionBaseline(), {
      EDGE_REPLAY_REQUIRE_REDIS: "false"
    });
    expect(() => loadEnvModule()).toThrow(/EDGE_REPLAY_REQUIRE_REDIS must be true/);
  });

  it("rejects production startup without REDIS_URL", () => {
    Object.assign(process.env, productionBaseline());
    process.env.REDIS_URL = "";
    expect(() => loadEnvModule()).toThrow(/REDIS_URL is required/);
  });

  it("rejects SIMULATION operating mode in production by default", () => {
    Object.assign(process.env, productionBaseline(), {
      GRIDFLEX_OPERATING_MODE: "SIMULATION",
      ALLOW_SIMULATION_IN_PRODUCTION: "false"
    });
    expect(() => loadEnvModule()).toThrow(/GRIDFLEX_OPERATING_MODE=SIMULATION is forbidden/);
  });

  it("allows SIMULATION in production only with explicit authorisation flag", () => {
    Object.assign(process.env, productionBaseline(), {
      GRIDFLEX_OPERATING_MODE: "SIMULATION",
      ALLOW_SIMULATION_IN_PRODUCTION: "true"
    });
    const mod = loadEnvModule();
    expect(mod.env.GRIDFLEX_OPERATING_MODE).toBe("SIMULATION");
  });

  it("allows PILOT_LIVE in production without simulation escape hatch", () => {
    Object.assign(process.env, productionBaseline(), {
      GRIDFLEX_OPERATING_MODE: "PILOT_LIVE",
      ALLOW_SIMULATION_IN_PRODUCTION: "false"
    });
    const mod = loadEnvModule();
    expect(mod.env.GRIDFLEX_OPERATING_MODE).toBe("PILOT_LIVE");
  });
});
