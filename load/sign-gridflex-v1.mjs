/**
 * Node-side GRIDFLEX-V1 HMAC signer for load tests.
 *
 * Usage:
 *   node load/sign-gridflex-v1.mjs --device DEVICE --credential CRED --secret B64URL --body body.json --seq 1
 */

import { createHash, createHmac, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

const get = (flag) => {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

const deviceId = get("--device");
const credentialId = get("--credential");
const secretB64 = get("--secret");
const bodyPath = get("--body");
const seq = get("--seq") || "1";
const keyVersion = get("--key-version") || "1";

if (!deviceId || !credentialId || !secretB64 || !bodyPath) {
  console.error(
    "Usage: node load/sign-gridflex-v1.mjs --device ID --credential CRED --secret B64URL --body file.json [--seq N]"
  );
  process.exit(1);
}

const body = readFileSync(bodyPath);
const timestamp = Math.floor(Date.now() / 1000).toString();
const nonce = randomBytes(16).toString("base64url");
const bodyHash = createHash("sha256").update(body).digest("hex");
const canonical = [
  "GRIDFLEX-V1",
  deviceId,
  credentialId,
  String(keyVersion),
  timestamp,
  nonce,
  String(seq),
  bodyHash
].join("\n");

const key = Buffer.from(secretB64, "base64url");
const signature = createHmac("sha256", key).update(canonical, "utf8").digest("base64url");

const headers = {
  "content-type": "application/json",
  "x-gridflex-device-id": deviceId,
  "x-gridflex-credential-id": credentialId,
  "x-gridflex-key-version": keyVersion,
  "x-gridflex-timestamp": timestamp,
  "x-gridflex-nonce": nonce,
  "x-gridflex-sequence-number": seq,
  "x-gridflex-signature": signature
};

console.log(JSON.stringify({ headers, bodyBytes: body.length, canonicalPreview: canonical.split("\n").slice(0, 3) }, null, 2));
