import { generateKeyPairSync, sign, verify } from "node:crypto";
import { writeFileSync } from "node:fs";

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const msg = Buffer.from(
  JSON.stringify({
    approvedFirmwareMinimum: "5.0.0",
    configurationVersion: "kat-1",
    enabledTelemetryKeys: ["current", "power", "voltage"],
    expiresAt: "2099-01-01T00:00:00.000Z",
    issuedAt: "2026-07-20T00:00:00.000Z",
    pollingIntervalMs: 60000,
    serverEndpoint: "https://example.com/api/edge-data"
  }),
  "utf8"
);
const sig = sign(null, msg, privateKey);
if (!verify(null, msg, publicKey, sig)) {
  throw new Error("self-verify failed");
}
const pubDer = publicKey.export({ type: "spki", format: "der" });
const rawPub = pubDer.subarray(pubDer.length - 32);
const out = {
  messageUtf8: msg.toString("utf8"),
  messageBase64Url: msg.toString("base64url"),
  signatureBase64Url: sig.toString("base64url"),
  signatureHex: sig.toString("hex"),
  publicKeyRawHex: rawPub.toString("hex"),
  publicKeyPem: publicKey.export({ type: "spki", format: "pem" }).toString(),
  privateKeyPem: privateKey.export({ type: "pkcs8", format: "pem" }).toString()
};
writeFileSync("backend/tests/fixtures/ed25519-remote-config-kat.json", JSON.stringify(out, null, 2));
console.log("wrote KAT", out.publicKeyRawHex.slice(0, 16) + "...");
