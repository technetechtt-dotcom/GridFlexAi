import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createPublicKey, verify } from "node:crypto";

import { canonicalizeRemoteConfig, verifyRemoteConfigSignature } from "../src/services/edge-remote-config.service.js";
import { buildFc03Response, crc16Modbus, parseFc03Response } from "../src/edge/modbus-rtu-frame.js";
import { JournaledStoreAndForwardQueue } from "../src/edge/journaled-queue.js";

const fixturePath = join(__dirname, "fixtures", "ed25519-remote-config-kat.json");

describe("Ed25519 known-answer vectors (host ↔ firmware)", () => {
  const kat = JSON.parse(readFileSync(fixturePath, "utf8")) as {
    messageUtf8: string;
    signatureBase64Url: string;
    signatureHex: string;
    publicKeyPem: string;
    publicKeyRawHex: string;
  };

  it("Node crypto verifies the locked KAT signature", () => {
    const ok = verify(
      null,
      Buffer.from(kat.messageUtf8, "utf8"),
      createPublicKey(kat.publicKeyPem),
      Buffer.from(kat.signatureHex, "hex")
    );
    expect(ok).toBe(true);
  });

  it("verifyRemoteConfigSignature accepts the KAT", () => {
    expect(verifyRemoteConfigSignature(kat.messageUtf8, kat.signatureBase64Url, kat.publicKeyPem)).toBe(
      true
    );
  });

  it("tampered message fails", () => {
    const tampered = `x${kat.messageUtf8.slice(1)}`;
    expect(verifyRemoteConfigSignature(tampered, kat.signatureBase64Url, kat.publicKeyPem)).toBe(false);
  });

  it("canonical remote-config shape matches KAT message field order", () => {
    const canonical = canonicalizeRemoteConfig({
      approvedFirmwareMinimum: "5.0.0",
      configurationVersion: "kat-1",
      enabledTelemetryKeys: ["voltage", "power", "current"],
      expiresAt: "2099-01-01T00:00:00.000Z",
      issuedAt: "2026-07-20T00:00:00.000Z",
      pollingIntervalMs: 60000,
      serverEndpoint: "https://example.com/api/edge-data"
    });
    expect(canonical).toBe(kat.messageUtf8);
  });
});

describe("Modbus RTU HIL frame faults (host)", () => {
  it("CRC errors are rejected", () => {
    const good = buildFc03Response(1, [2300, 1500]);
    const bad = new Uint8Array(good);
    bad[bad.length - 1] ^= 0xff;
    expect(parseFc03Response(bad, 1, 2)).toEqual({ ok: false, reason: "crc" });
  });

  it("malformed byte-count length is rejected", () => {
    const good = buildFc03Response(1, [1, 2]);
    const bad = new Uint8Array(good);
    bad[2] = 2; // should be 4 for qty 2
    // Fix CRC so length check fails first
    const crc = crc16Modbus(bad.subarray(0, bad.length - 2));
    bad[bad.length - 2] = crc & 0xff;
    bad[bad.length - 1] = (crc >> 8) & 0xff;
    expect(parseFc03Response(bad, 1, 2)).toEqual({ ok: false, reason: "length" });
  });

  it("truncated frames are rejected", () => {
    const good = buildFc03Response(1, [1]);
    expect(parseFc03Response(good.subarray(0, 4), 1, 1)).toEqual({ ok: false, reason: "truncated" });
  });

  it("oversized frames are rejected", () => {
    const good = buildFc03Response(1, [1]);
    const oversized = new Uint8Array(good.length + 2);
    oversized.set(good);
    expect(parseFc03Response(oversized, 1, 1)).toEqual({ ok: false, reason: "oversized" });
  });

  it("unsupported function code is rejected", () => {
    const good = buildFc03Response(1, [1]);
    const bad = new Uint8Array(good);
    bad[1] = 0x06; // write single register — forbidden
    const crc = crc16Modbus(bad.subarray(0, bad.length - 2));
    bad[bad.length - 2] = crc & 0xff;
    bad[bad.length - 1] = (crc >> 8) & 0xff;
    expect(parseFc03Response(bad, 1, 1)).toEqual({ ok: false, reason: "function" });
  });

  it("valid frame decodes registers", () => {
    const frame = buildFc03Response(1, [0x0906, 0xfffd]);
    const parsed = parseFc03Response(frame, 1, 2);
    expect(parsed).toEqual({ ok: true, slave: 1, registers: [0x0906, 0xfffd] });
  });
});

describe("Journaled queue power-loss stages", () => {
  it("crash after journal before data — recover drops incomplete enqueue", () => {
    const q = new JournaledStoreAndForwardQueue(10);
    q.beginEnqueueJournal({ v: 1 }, "2026-07-20T10:00:00Z", "11111111-1111-4111-a111-111111111111");
    // crash: no completeEnqueueData
    q.recoverAfterCrash();
    expect(q.depth).toBe(0);
    expect(q.journal).toBeNull();
  });

  it("crash after data before meta — recover commits meta", () => {
    const q = new JournaledStoreAndForwardQueue(10);
    q.beginEnqueueJournal({ v: 1 }, "2026-07-20T10:00:00Z", "11111111-1111-4111-a111-111111111111");
    q.completeEnqueueData();
    q.recoverAfterCrash();
    expect(q.depth).toBe(1);
    expect(q.peek()?.payload).toEqual({ v: 1 });
  });

  it("crash after meta before journal clear — recover is idempotent", () => {
    const q = new JournaledStoreAndForwardQueue(10);
    q.beginEnqueueJournal({ v: 1 }, "2026-07-20T10:00:00Z", "11111111-1111-4111-a111-111111111111");
    q.completeEnqueueData();
    q.commitMetaFromJournal();
    // journal still present
    expect(q.journal).not.toBeNull();
    q.recoverAfterCrash();
    expect(q.depth).toBe(1);
    q.acknowledge(1);
    expect(q.depth).toBe(0);
  });

  it("duplicate ack after reconnect is safe", () => {
    const q = new JournaledStoreAndForwardQueue(10);
    q.enqueue({ v: 1 }, "2026-07-20T10:00:00Z", "11111111-1111-4111-a111-111111111111");
    expect(q.acknowledge(1)).toBe(true);
    expect(q.acknowledge(1)).toBe(false);
  });
});
