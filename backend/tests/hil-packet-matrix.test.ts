/**
 * Phase 6 — HIL packet-robustness matrix (staging-safe, no live plant control).
 */

import { edgeDataBodySchema } from "../src/schemas/request.schemas.js";
import { ingestTelemetryBatch } from "../src/services/telemetry.service.js";
import {
  canonicalizeRemoteConfig,
  validateRemoteConfigRanges,
  verifyRemoteConfigSignature,
  generateEdgeConfigSigningKeyPair
} from "../src/services/edge-remote-config.service.js";
import { PersistentStoreAndForwardQueue } from "../src/edge/store-and-forward-queue.js";
import { createPrivateKey, sign } from "node:crypto";

jest.mock("../src/lib/prisma.js", () => ({
  prisma: {
    asset: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: "asset-1",
          plantId: "plant-1",
          plant: { organisationId: "org-1", siteId: "site-1" },
          pointDefinitions: [
            { id: "pd-1", key: "active_power_kw", unit: "kW", minimumValidValue: 0, maximumValidValue: 5000, sourceType: "measured" }
          ]
        }
      ])
    },
    telemetryReading: {
      create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => data)
    }
  }
}));

import { prisma } from "../src/lib/prisma.js";

describe("HIL packet robustness matrix", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TELEMETRY_INVALID_POLICY = "tag";
    process.env.EDGE_INGEST_MAX_SKEW_SECONDS = "300";
  });

  it("HIL-01 malformed JSON schema → validation failure (no finite fields)", () => {
    const parsed = edgeDataBodySchema.safeParse({ voltage: "NaN", current: 1, power: 1 });
    expect(parsed.success).toBe(false);
  });

  it("HIL-02 missing required fields → Zod failure", () => {
    const parsed = edgeDataBodySchema.safeParse({ voltage: 230 });
    expect(parsed.success).toBe(false);
  });

  it("HIL-03 NaN / infinity numericValue rejected", async () => {
    const result = await ingestTelemetryBatch([
      {
        assetId: "asset-1",
        key: "active_power_kw",
        numericValue: Number.NaN,
        unit: "kW",
        deviceTimestamp: new Date().toISOString(),
        sequenceNumber: 1
      }
    ]);
    expect(result.rejected).toBe(1);
    expect(result.errors[0]?.message).toMatch(/finite/i);
  });

  it("HIL-04 oversized batch → 413 semantics", async () => {
    await expect(
      ingestTelemetryBatch(
        Array.from({ length: 3 }, (_, i) => ({
          assetId: "asset-1",
          key: "active_power_kw",
          numericValue: 1,
          unit: "kW",
          deviceTimestamp: new Date().toISOString(),
          sequenceNumber: i
        })),
        { maxItems: 2 }
      )
    ).rejects.toMatchObject({ statusCode: 413 });
  });

  it("HIL-05 excess voltage / out-of-range → invalid quality (not good KPI)", async () => {
    const result = await ingestTelemetryBatch([
      {
        assetId: "asset-1",
        key: "active_power_kw",
        numericValue: 99999,
        unit: "kW",
        deviceTimestamp: new Date().toISOString(),
        sequenceNumber: 10
      }
    ]);
    expect(result.accepted).toBe(1);
    expect(result.taggedInvalid).toBe(1);
    expect((prisma.telemetryReading.create as jest.Mock).mock.calls[0][0].data.quality).toBe("invalid");
  });

  it("HIL-06 negative PV power flagged uncertain, not silently normalized", async () => {
    const result = await ingestTelemetryBatch([
      {
        assetId: "asset-1",
        key: "active_power_kw",
        numericValue: -50,
        unit: "kW",
        deviceTimestamp: new Date().toISOString(),
        sequenceNumber: 11
      }
    ]);
    expect(result.accepted).toBe(1);
    const quality = (prisma.telemetryReading.create as jest.Mock).mock.calls[0][0].data.quality;
    expect(quality === "uncertain" || quality === "invalid").toBe(true);
    expect((prisma.telemetryReading.create as jest.Mock).mock.calls[0][0].data.numericValue).toBe(-50);
  });

  it("HIL-07 future timestamp beyond tolerance rejected", async () => {
    const future = new Date(Date.now() + 10 * 60_000).toISOString();
    const result = await ingestTelemetryBatch([
      {
        assetId: "asset-1",
        key: "active_power_kw",
        numericValue: 10,
        unit: "kW",
        deviceTimestamp: future,
        sequenceNumber: 12
      }
    ]);
    expect(result.rejected).toBe(1);
    expect(result.errors[0]?.message).toMatch(/future/i);
  });

  it("HIL-08 delayed/stale measurement stored with stale quality", async () => {
    const old = new Date(Date.now() - 60 * 60_000).toISOString();
    const result = await ingestTelemetryBatch([
      {
        assetId: "asset-1",
        key: "active_power_kw",
        numericValue: 10,
        unit: "kW",
        deviceTimestamp: old,
        sequenceNumber: 13
      }
    ]);
    expect(result.accepted).toBe(1);
    expect((prisma.telemetryReading.create as jest.Mock).mock.calls[0][0].data.quality).toBe("stale");
  });

  it("HIL-09 duplicate telemetry unique key counted as duplicate ACK path", async () => {
    (prisma.telemetryReading.create as jest.Mock)
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce({ code: "P2002", message: "Unique constraint" });

    const item = {
      assetId: "asset-1",
      key: "active_power_kw",
      numericValue: 10,
      unit: "kW",
      deviceTimestamp: new Date().toISOString(),
      sequenceNumber: 14
    };
    const first = await ingestTelemetryBatch([item]);
    const second = await ingestTelemetryBatch([item]);
    expect(first.accepted).toBe(1);
    expect(second.duplicates).toBe(1);
    expect(second.accepted).toBe(0);
  });

  it("HIL-10 lost LTE / reconnect — queue grows then ordered replay", () => {
    const q = new PersistentStoreAndForwardQueue({ maxRecords: 100 });
    for (let i = 0; i < 5; i++) {
      q.enqueue({ i }, `2026-07-20T08:3${i}:00Z`, `${i}1111111-1111-4111-a111-11111111111${i}`);
    }
    expect(q.depth).toBe(5);
    // reconnect replay
    expect(q.peek()?.sequenceNumber).toBe(1);
    q.acknowledge(1);
    expect(q.peek()?.sequenceNumber).toBe(2);
  });

  it("HIL-11 power loss — queue survives reboot snapshot", () => {
    const q = new PersistentStoreAndForwardQueue({ maxRecords: 50 });
    q.enqueue({ v: 1 }, "2026-07-20T08:30:00Z", "11111111-1111-4111-a111-111111111111");
    const snap = q.snapshotForReboot();
    const q2 = new PersistentStoreAndForwardQueue({ maxRecords: 50 });
    q2.loadAfterReboot(snap, q.sequenceCursor);
    expect(q2.depth).toBe(1);
  });

  it("HIL-12 unsigned / expired remote config rejected", () => {
    const { privateKey, publicKey } = generateEdgeConfigSigningKeyPair();
    const publicPem = publicKey.export({ type: "spki", format: "pem" }).toString();
    const privatePem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    const payload = {
      configurationVersion: "cfg-x",
      pollingIntervalMs: 60000,
      serverEndpoint: "https://example.com/api/edge-data",
      enabledTelemetryKeys: ["voltage"],
      approvedFirmwareMinimum: "5.0.0",
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString()
    };
    const canonical = canonicalizeRemoteConfig(payload);
    const goodSig = sign(null, Buffer.from(canonical, "utf8"), createPrivateKey(privatePem)).toString("base64url");
    expect(verifyRemoteConfigSignature(canonical, goodSig, publicPem)).toBe(true);
    expect(verifyRemoteConfigSignature(canonical, "AAAA", publicPem)).toBe(false);
    expect(() =>
      validateRemoteConfigRanges({
        ...payload,
        issuedAt: new Date(Date.now() - 86_400_000).toISOString(),
        expiresAt: new Date(Date.now() - 1).toISOString()
      })
    ).toThrow(/expired/i);
  });

  it("HIL-13 Zod rejects non-finite edge body (NaN coercion)", () => {
    const parsed = edgeDataBodySchema.safeParse({
      voltage: Number.POSITIVE_INFINITY,
      current: 1,
      power: 1
    });
    expect(parsed.success).toBe(false);
  });

  it("HIL-14 remote config rejects physical-control fields", () => {
    expect(() =>
      validateRemoteConfigRanges({
        configurationVersion: "cfg-bad",
        pollingIntervalMs: 60000,
        serverEndpoint: "https://example.com/api/edge-data",
        enabledTelemetryKeys: ["voltage", "setpoint_kw"],
        approvedFirmwareMinimum: "5.0.0",
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60_000).toISOString()
      })
    ).toThrow(/control-oriented|physical/i);
  });

  it("HIL-16 delayed ingest tagged stale", async () => {
    const old = new Date(Date.now() - 3_600_000).toISOString();
    const result = await ingestTelemetryBatch([
      {
        assetId: "asset-1",
        key: "active_power_kw",
        numericValue: 10,
        unit: "kW",
        deviceTimestamp: old,
        sequenceNumber: 100
      }
    ]);
    expect(result.accepted).toBe(1);
    expect((prisma.telemetryReading.create as jest.Mock).mock.calls.at(-1)?.[0].data.quality).toBe(
      "stale"
    );
  });

  it("HIL-17 disconnect — queue retains records until ordered ACK", () => {
    const q = new PersistentStoreAndForwardQueue({ maxRecords: 20 });
    q.enqueue({ n: 1 }, "2026-07-20T08:00:00Z", "11111111-1111-4111-a111-111111111111");
    q.enqueue({ n: 2 }, "2026-07-20T08:01:00Z", "22222222-2222-4222-a222-222222222222");
    // disconnect window: no ACK
    expect(q.depth).toBe(2);
    expect(q.peek()?.sequenceNumber).toBe(1);
    q.acknowledge(1);
    expect(q.peek()?.sequenceNumber).toBe(2);
  });

  it("HIL-18 reset recovery — reboot snapshot preserves measuredAt", () => {
    const q = new PersistentStoreAndForwardQueue({ maxRecords: 20 });
    q.enqueue({ n: 1 }, "2026-07-20T08:00:00Z", "11111111-1111-4111-a111-111111111111");
    const snap = q.snapshotForReboot();
    const q2 = new PersistentStoreAndForwardQueue({ maxRecords: 20 });
    q2.loadAfterReboot(snap, q.sequenceCursor);
    expect(q2.peek()?.measuredAt).toBe("2026-07-20T08:00:00Z");
  });
});

/** Evidence checklist keys for plant sign-off worksheets. */
export const HIL_EVIDENCE_FIELDS = [
  "testIdentifier",
  "firmwareVersion",
  "backendCommit",
  "hardwareSerialNumber",
  "setup",
  "expectedResult",
  "actualResult",
  "logExtract",
  "screenshotOrOutput",
  "passFail",
  "reviewer",
  "date"
] as const;

describe("HIL evidence template completeness", () => {
  it("lists required evidence fields", () => {
    expect(HIL_EVIDENCE_FIELDS).toHaveLength(12);
    expect(HIL_EVIDENCE_FIELDS).toContain("passFail");
  });
});
