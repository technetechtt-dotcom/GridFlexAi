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
  JWT_SECRET: "production-jwt-secret-with-32-characters-minimum",
  CORS_ORIGIN: "https://app.gridflex.example",
  ADMIN_REQUIRE_HTTPS: "true",
  EDGE_ALLOW_LEGACY_SHARED_SECRET: "false",
  EDGE_INGEST_SHARED_SECRET: "production-edge-secret-with-32-characters",
  REDIS_URL: "redis://localhost:6379",
  PHYSICAL_COMMAND_EXECUTION_ENABLED: "false",
  HIL_PLANT_APPROVAL_CONFIRMED: "false",
  DEVICE_SECRET_VAULT_PROVIDER: "aws_kms",
  AWS_KMS_KEY_ID: "arn:aws:kms:eu-west-1:123456789012:key/example"
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
});
