import { createEdgeSignature, safeSignatureEquals } from "../src/utils/edgeDeviceAuth.js";

describe("edgeDeviceAuth test vector", () => {
  it("matches the known HMAC signature vector", () => {
    const payload = {
      current: 11.2,
      nodeId: "esp32-node-1",
      power: 7.16,
      voltage: 640
    };

    const signature = createEdgeSignature(
      {
        deviceId: "esp32-node-1",
        timestamp: "1713187200000",
        nonce: "abc123nonce",
        payload
      },
      "test-edge-shared-secret-123"
    );

    expect(signature).toBe("f09bff4fc8f1894f56e24d01a88ea7947646ff6d3f3cb499e04fa7d33d7715a9");
    expect(safeSignatureEquals(signature, "f09bff4fc8f1894f56e24d01a88ea7947646ff6d3f3cb499e04fa7d33d7715a9")).toBe(true);
  });

  it("is insensitive to payload key order via canonicalization", () => {
    const payloadA = {
      current: 11.2,
      nodeId: "esp32-node-1",
      power: 7.16,
      voltage: 640
    };
    const payloadB = {
      voltage: 640,
      power: 7.16,
      nodeId: "esp32-node-1",
      current: 11.2
    };

    const signatureA = createEdgeSignature(
      {
        deviceId: "esp32-node-1",
        timestamp: "1713187200000",
        nonce: "abc123nonce",
        payload: payloadA
      },
      "test-edge-shared-secret-123"
    );

    const signatureB = createEdgeSignature(
      {
        deviceId: "esp32-node-1",
        timestamp: "1713187200000",
        nonce: "abc123nonce",
        payload: payloadB
      },
      "test-edge-shared-secret-123"
    );

    expect(signatureA).toBe(signatureB);
  });
});
