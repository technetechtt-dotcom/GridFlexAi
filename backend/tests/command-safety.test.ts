import {
  canTransitionCommand,
  COMMAND_TRANSITIONS,
  HIGH_RISK_LEVELS
} from "../src/domain/commands.js";
import {
  assertCommandInRange,
  assertCommandNotExpired,
  assertRampRate,
  assertSeparationOfDuties,
  validateCommandPayload
} from "../src/services/command-validation.js";
import {
  applyWithLocalSafety,
  evaluateLocalSafety,
  type SafetyAdapter,
  type SignedCommandPackage,
  type SignedLocalLimits
} from "../src/safety/local-safety-controller.js";
import {
  createModbusTcpAdapter,
  createIec61850Placeholder,
  FICTITIOUS_INVERTER_MODBUS_MAP,
  parseRegisterMap,
  assertWriteAllowed
} from "../src/gateway/index.js";
import { AppError } from "../src/utils/AppError.js";

describe("command state machine", () => {
  it("allows proposed -> pending_approval -> approved -> queued", () => {
    expect(canTransitionCommand("proposed", "pending_approval")).toBe(true);
    expect(canTransitionCommand("pending_approval", "approved")).toBe(true);
    expect(canTransitionCommand("approved", "queued")).toBe(true);
    expect(canTransitionCommand("proposed", "verified")).toBe(false);
  });

  it("defines terminal statuses with no outbound transitions", () => {
    for (const status of ["rejected", "expired", "verified", "rolled_back", "cancelled"] as const) {
      expect(COMMAND_TRANSITIONS[status]).toEqual([]);
    }
  });

  it("marks high and critical as high-risk", () => {
    expect(HIGH_RISK_LEVELS.has("high")).toBe(true);
    expect(HIGH_RISK_LEVELS.has("critical")).toBe(true);
    expect(HIGH_RISK_LEVELS.has("low")).toBe(false);
  });
});

describe("command validation", () => {
  it("rejects expired commands", () => {
    expect(() =>
      assertCommandNotExpired({
        expiresAt: new Date("2020-01-01T00:00:00.000Z"),
        now: new Date("2020-01-02T00:00:00.000Z")
      })
    ).toThrow(AppError);
  });

  it("enforces range limits", () => {
    expect(() =>
      assertCommandInRange({
        requestedValue: 120,
        minimumAllowed: 0,
        maximumAllowed: 100
      })
    ).toThrow(/maximumAllowed/);
  });

  it("enforces ramp rate", () => {
    expect(() =>
      assertRampRate({
        requestedValue: 50,
        currentValue: 10,
        maxRampPerMinute: 20,
        rampWindowMinutes: 1
      })
    ).toThrow(/ramp/);
  });

  it("enforces separation of duties", () => {
    expect(() =>
      assertSeparationOfDuties({
        requesterId: "user-a",
        approverId: "user-a",
        requireSeparationOfDuties: true,
        riskLevel: "high"
      })
    ).toThrow(/Separation of duties/);
  });

  it("passes a valid payload", () => {
    expect(() =>
      validateCommandPayload({
        requestedValue: 25,
        currentValue: 20,
        minimumAllowed: 0,
        maximumAllowed: 100,
        maxRampPerMinute: 10,
        expiresAt: new Date(Date.now() + 60_000)
      })
    ).not.toThrow();
  });
});

describe("local safety controller", () => {
  const limits: SignedLocalLimits = {
    version: "limits-v1",
    siteId: "site-1",
    deviceId: "inv-1",
    signature: "sig-limits",
    signedAt: "2026-07-19T00:00:00.000Z",
    minimumAllowed: 0,
    maximumAllowed: 100,
    maxRampPerMinute: 30,
    interlocks: ["estop", "door_open"]
  };

  const baseCommand: SignedCommandPackage = {
    commandId: "cmd-1",
    siteId: "site-1",
    deviceId: "inv-1",
    commandType: "power_setpoint_kw",
    requestedValue: 40,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    signature: "sig-cmd",
    expectedLimitsVersion: "limits-v1"
  };

  it("rejects expired packages", () => {
    const decision = evaluateLocalSafety(
      { ...baseCommand, expiresAt: "2020-01-01T00:00:00.000Z" },
      {
        communicationHealthy: true,
        currentValue: 20,
        activeInterlocks: [],
        limits
      }
    );
    expect(decision.allowed).toBe(false);
  });

  it("rejects when cloud limits version does not match local signed limits", () => {
    const decision = evaluateLocalSafety(
      { ...baseCommand, expectedLimitsVersion: "cloud-v99" },
      {
        communicationHealthy: true,
        currentValue: 20,
        activeInterlocks: [],
        limits
      }
    );
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.reason).toMatch(/limits version/);
    }
  });

  it("enters safe state on communication loss", () => {
    const decision = evaluateLocalSafety(baseCommand, {
      communicationHealthy: false,
      currentValue: 20,
      activeInterlocks: [],
      limits
    });
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.safeState).toBe("trip");
    }
  });

  it("simulates successful apply when physical is disabled", async () => {
    const adapter: SafetyAdapter = {
      sendSetpoint: jest.fn(async () => ({ acknowledged: true })),
      readBack: jest.fn(async () => 40),
      enterSafeState: jest.fn(async () => undefined)
    };
    const report = await applyWithLocalSafety(
      baseCommand,
      {
        communicationHealthy: true,
        currentValue: 20,
        activeInterlocks: [],
        limits
      },
      adapter,
      { physicalEnabled: false }
    );
    expect(report.verified).toBe(true);
    expect(adapter.sendSetpoint).not.toHaveBeenCalled();
  });
});

describe("industrial gateway", () => {
  it("parses fictitious inverter map and labels it clearly", () => {
    const map = parseRegisterMap(FICTITIOUS_INVERTER_MODBUS_MAP);
    expect(map.fictitious).toBe(true);
    expect(map.label).toMatch(/FICTITIOUS EXAMPLE/i);
  });

  it("rejects writes while physical flag is false", async () => {
    const adapter = createModbusTcpAdapter(FICTITIOUS_INVERTER_MODBUS_MAP);
    await adapter.connect({
      protocol: "modbus_tcp",
      endpoint: "sim://inverter",
      timeoutMs: 1000,
      retries: 1,
      readOnly: false,
      physicalCommandExecutionEnabled: false
    });
    await expect(adapter.writePoint("power_setpoint_kw", 10)).rejects.toThrow(/disabled/i);
  });

  it("allows simulated reads without inventing real vendor addresses", async () => {
    const adapter = createModbusTcpAdapter(FICTITIOUS_INVERTER_MODBUS_MAP);
    await adapter.connect({
      protocol: "modbus_tcp",
      endpoint: "sim://inverter",
      timeoutMs: 1000,
      retries: 1,
      readOnly: true,
      physicalCommandExecutionEnabled: false
    });
    adapter.seedPoint("active_power_kw", 12.5);
    const readings = await adapter.readPoints(["active_power_kw"]);
    expect(readings[0]?.value).toBe(12.5);
    expect(readings[0]?.sourceType).toBe("simulated");
  });

  it("keeps IEC 61850 as a placeholder", async () => {
    const placeholder = createIec61850Placeholder();
    const health = await placeholder.health();
    expect(health.ok).toBe(false);
    await expect(placeholder.readPoints(["x"])).rejects.toThrow(/placeholder/i);
  });

  it("assertWriteAllowed blocks read-only mode", () => {
    expect(() =>
      assertWriteAllowed({
        protocol: "modbus_tcp",
        endpoint: "x",
        timeoutMs: 1,
        retries: 0,
        readOnly: true,
        physicalCommandExecutionEnabled: true
      })
    ).toThrow(/read-only/i);
  });
});
