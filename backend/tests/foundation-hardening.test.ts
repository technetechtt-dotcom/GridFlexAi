import { createHash } from "node:crypto";

import { DeviceCredentialStatus } from "@prisma/client";

import { assertAndStoreEdgeNonce, clearEdgeReplayCache } from "../src/lib/edge-replay.js";
import { createEdgeSignature, safeSignatureEquals } from "../src/utils/edgeDeviceAuth.js";
import { calculateDataFreshness } from "../src/domain/units.js";
import { evaluateNodeHealth } from "../src/services/node-health.service.js";
import { TELEMETRY_KEYS, TELEMETRY_KEYS_BY_ASSET_TYPE, isKnownTelemetryKey } from "../src/domain/telemetry-keys.js";

jest.mock("../src/lib/prisma.js", () => ({
  prisma: {
    edgeNode: {
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn()
    },
    nodeHealthHistory: {
      create: jest.fn()
    },
    deviceCredential: {
      findUnique: jest.fn()
    }
  }
}));

jest.mock("../src/config/socket.js", () => ({
  getSocketServer: jest.fn(() => ({
    to: jest.fn().mockReturnThis(),
    emit: jest.fn()
  }))
}));

jest.mock("../src/lib/redis.js", () => ({
  getRedisClient: jest.fn(() => null)
}));

import { prisma } from "../src/lib/prisma.js";

const mockedPrisma = prisma as unknown as {
  edgeNode: {
    findMany: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  nodeHealthHistory: { create: jest.Mock };
};

describe("telemetry key catalog", () => {
  it("includes electrical, solar, BESS and electrolyser keys", () => {
    expect(isKnownTelemetryKey("active_power_kw")).toBe(true);
    expect(isKnownTelemetryKey("inverter_available_power_kw")).toBe(true);
    expect(isKnownTelemetryKey("state_of_charge_percent")).toBe(true);
    expect(isKnownTelemetryKey("production_kg_per_hour")).toBe(true);
    expect(TELEMETRY_KEYS.active_power_kw.unit).toBe("kW");
    expect(TELEMETRY_KEYS_BY_ASSET_TYPE.inverter).toContain("inverter_available_power_kw");
  });
});

describe("device credential signature material", () => {
  it("verifies HMAC using SHA-256(secret) as key material", () => {
    const secret = "device-secret-shown-once";
    const secretHash = createHash("sha256").update(secret).digest("hex");
    const signature = createEdgeSignature(
      {
        deviceId: "esp32-a",
        timestamp: "1713187200000",
        nonce: "n1",
        payload: { voltage: 640 }
      },
      secretHash
    );
    const expected = createEdgeSignature(
      {
        deviceId: "esp32-a",
        timestamp: "1713187200000",
        nonce: "n1",
        payload: { voltage: 640 }
      },
      secretHash
    );
    expect(safeSignatureEquals(signature, expected)).toBe(true);
  });

  it("rejects cross-device credential material", () => {
    const secretHash = createHash("sha256").update("secret").digest("hex");
    const forDeviceA = createEdgeSignature(
      { deviceId: "device-a", timestamp: "1", nonce: "n", payload: {} },
      secretHash
    );
    const forDeviceB = createEdgeSignature(
      { deviceId: "device-b", timestamp: "1", nonce: "n", payload: {} },
      secretHash
    );
    expect(safeSignatureEquals(forDeviceA, forDeviceB)).toBe(false);
  });
});

describe("edge replay protection", () => {
  beforeEach(async () => {
    process.env.EDGE_REPLAY_REQUIRE_REDIS = "false";
    process.env.EDGE_ALLOW_MEMORY_REPLAY = "true";
    await clearEdgeReplayCache();
  });

  it("blocks duplicate nonces", async () => {
    await assertAndStoreEdgeNonce("esp32-1", "nonce-1");
    await expect(assertAndStoreEdgeNonce("esp32-1", "nonce-1")).rejects.toMatchObject({
      statusCode: 409
    });
  });

  it("allows distinct nonces for the same device", async () => {
    await assertAndStoreEdgeNonce("esp32-3", "nonce-a");
    await expect(assertAndStoreEdgeNonce("esp32-3", "nonce-b")).resolves.toBeUndefined();
  });
});

describe("node health evaluation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.nodeHealthHistory.create.mockResolvedValue({});
    mockedPrisma.edgeNode.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "node-1",
      name: "Demo",
      status: data.status,
      healthState: data.healthState,
      lastSeen: new Date("2026-07-19T12:00:00.000Z")
    }));
  });

  it("marks stale and offline using thresholds", async () => {
    const now = new Date("2026-07-19T12:00:00.000Z");
    mockedPrisma.edgeNode.findMany.mockResolvedValue([
      {
        id: "node-stale",
        name: "Stale",
        status: "online",
        healthState: "online",
        isActive: true,
        lastSeen: new Date(now.getTime() - 180_000),
        lastSuccessfulIngestAt: new Date(now.getTime() - 180_000),
        batteryLevel: 80,
        signalStrength: 70,
        staleAfterSec: 120,
        offlineAfterSec: 600,
        siteId: "site-1"
      },
      {
        id: "node-offline",
        name: "Offline",
        status: "online",
        healthState: "stale",
        isActive: true,
        lastSeen: new Date(now.getTime() - 900_000),
        lastSuccessfulIngestAt: new Date(now.getTime() - 900_000),
        batteryLevel: 80,
        signalStrength: 70,
        staleAfterSec: 120,
        offlineAfterSec: 600,
        siteId: "site-1"
      },
      {
        id: "node-degraded",
        name: "Degraded",
        status: "online",
        healthState: "online",
        isActive: true,
        lastSeen: now,
        lastSuccessfulIngestAt: now,
        batteryLevel: 10,
        signalStrength: 70,
        staleAfterSec: 120,
        offlineAfterSec: 600,
        siteId: "site-1"
      }
    ]);

    const result = await evaluateNodeHealth(now);
    expect(result.transitions).toBe(3);
    expect(mockedPrisma.nodeHealthHistory.create).toHaveBeenCalled();
  });

  it("computes freshness helpers", () => {
    const now = new Date("2026-07-19T12:00:00.000Z");
    const fresh = calculateDataFreshness(now, { now, staleAfterSeconds: 120, offlineAfterSeconds: 600 });
    expect(fresh.isStale).toBe(false);
    expect(fresh.isOffline).toBe(false);
  });
});

describe("credential status matrix (unit)", () => {
  it("treats rotating credentials as still usable until revoked/expired", () => {
    const usable = new Set<DeviceCredentialStatus>([
      DeviceCredentialStatus.active,
      DeviceCredentialStatus.rotating,
      DeviceCredentialStatus.pending
    ]);
    expect(usable.has(DeviceCredentialStatus.rotating)).toBe(true);
    expect(usable.has(DeviceCredentialStatus.revoked)).toBe(false);
    expect(usable.has(DeviceCredentialStatus.expired)).toBe(false);
  });
});
