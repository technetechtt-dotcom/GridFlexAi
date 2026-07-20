import { PersistentStoreAndForwardQueue } from "../src/edge/store-and-forward-queue.js";
import {
  canonicalizeRemoteConfig,
  generateEdgeConfigSigningKeyPair,
  validateRemoteConfigRanges,
  verifyRemoteConfigSignature,
  type EdgeRemoteConfigPayload
} from "../src/services/edge-remote-config.service.js";
import { createPrivateKey, sign } from "node:crypto";

describe("PersistentStoreAndForwardQueue", () => {
  it("preserves measuredAt and only deletes after matching ACK", () => {
    const q = new PersistentStoreAndForwardQueue({ maxRecords: 10 });
    const measuredAt = "2026-07-20T08:30:00Z";
    const rec = q.enqueue({ voltage: 230, power: 5 }, measuredAt, "11111111-1111-4111-a111-111111111111");
    expect(rec.sequenceNumber).toBe(1);
    expect(rec.measuredAt).toBe(measuredAt);
    expect(q.depth).toBe(1);

    expect(q.acknowledge(99)).toBe(false);
    expect(q.depth).toBe(1);
    expect(q.acknowledge(1)).toBe(true);
    expect(q.depth).toBe(0);
  });

  it("never silently overwrites when full", () => {
    const q = new PersistentStoreAndForwardQueue({ maxRecords: 2 });
    q.enqueue({ a: 1 }, "2026-07-20T08:30:00Z", "11111111-1111-4111-a111-111111111111");
    q.enqueue({ a: 2 }, "2026-07-20T08:31:00Z", "22222222-2222-4222-a222-222222222222");
    expect(() =>
      q.enqueue({ a: 3 }, "2026-07-20T08:32:00Z", "33333333-3333-4333-a333-333333333333")
    ).toThrow(/refusing to overwrite/i);
    expect(q.depth).toBe(2);
    expect(q.peek()?.payload).toEqual({ a: 1 });
  });

  it("survives reboot snapshot with original timestamps and ordered replay", () => {
    const q = new PersistentStoreAndForwardQueue({ maxRecords: 100 });
    q.enqueue({ n: 1 }, "2026-07-20T08:30:00Z", "11111111-1111-4111-a111-111111111111");
    q.enqueue({ n: 2 }, "2026-07-20T08:31:00Z", "22222222-2222-4222-a222-222222222222");
    const snap = q.snapshotForReboot();
    const next = q.sequenceCursor;

    const restored = new PersistentStoreAndForwardQueue({ maxRecords: 100 });
    restored.loadAfterReboot(snap, next);
    expect(restored.depth).toBe(2);
    expect(restored.peek()?.measuredAt).toBe("2026-07-20T08:30:00Z");
    restored.acknowledge(1);
    expect(restored.peek()?.sequenceNumber).toBe(2);
  });

  it("applies exponential backoff with jitter", () => {
    const q = new PersistentStoreAndForwardQueue({ maxRecords: 5, baseBackoffMs: 1000, maxBackoffMs: 300000 });
    q.enqueue({ x: 1 }, "2026-07-20T08:30:00Z", "11111111-1111-4111-a111-111111111111");
    const b1 = q.markUploadFailure();
    const b2 = q.computeBackoffMs(2, () => 0);
    const b3 = q.computeBackoffMs(2, () => 0.999);
    expect(b1).toBeGreaterThanOrEqual(1000);
    expect(b2).toBe(2000);
    expect(b3).toBeGreaterThan(b2);
  });
});

describe("Ed25519 remote configuration", () => {
  const { privateKey, publicKey } = generateEdgeConfigSigningKeyPair();
  const privatePem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const publicPem = publicKey.export({ type: "spki", format: "pem" }).toString();

  const basePayload = (): EdgeRemoteConfigPayload => ({
    configurationVersion: "cfg-1",
    pollingIntervalMs: 60000,
    serverEndpoint: "https://example.com/api/edge-data",
    enabledTelemetryKeys: ["voltage", "current", "power"],
    approvedFirmwareMinimum: "5.0.0",
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400000).toISOString()
  });

  beforeAll(() => {
    process.env.EDGE_CONFIG_SIGNING_PRIVATE_KEY_PEM = privatePem;
    process.env.EDGE_CONFIG_SIGNING_PUBLIC_KEY_PEM = publicPem;
  });

  it("signs and verifies canonical payloads", () => {
    const payload = basePayload();
    const canonical = canonicalizeRemoteConfig(payload);
    const signature = sign(null, Buffer.from(canonical, "utf8"), createPrivateKey(privatePem)).toString(
      "base64url"
    );
    expect(verifyRemoteConfigSignature(canonical, signature, publicPem)).toBe(true);
  });

  it("rejects unsigned / tampered payloads", () => {
    const payload = basePayload();
    const canonical = canonicalizeRemoteConfig(payload);
    const signature = sign(null, Buffer.from(canonical, "utf8"), createPrivateKey(privatePem)).toString(
      "base64url"
    );
    expect(verifyRemoteConfigSignature(canonical + "x", signature, publicPem)).toBe(false);
  });

  it("rejects expired or out-of-range configuration", () => {
    expect(() =>
      validateRemoteConfigRanges({
        ...basePayload(),
        pollingIntervalMs: 100
      })
    ).toThrow(/pollingIntervalMs/);

    expect(() =>
      validateRemoteConfigRanges({
        ...basePayload(),
        issuedAt: new Date(Date.now() - 86_400_000).toISOString(),
        expiresAt: new Date(Date.now() - 1000).toISOString()
      })
    ).toThrow(/expired/i);
  });

  it("does not embed device HMAC secrets in the canonical form", () => {
    const canonical = canonicalizeRemoteConfig(basePayload());
    expect(canonical).not.toMatch(/secret|hmac|credential/i);
  });
});
