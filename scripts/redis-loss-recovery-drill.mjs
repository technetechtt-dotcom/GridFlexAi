/**
 * Local Redis loss/recovery drill under light edge-auth pressure.
 *
 * Prerequisites:
 *   - Redis reachable at REDIS_URL (default redis://127.0.0.1:6379)
 *   - Backend already listening (BASE_URL)
 *   - Optional: DEVICE_* for signed ingest during chaos
 *
 * Usage:
 *   REDIS_CHAOS_ALLOW=true node scripts/redis-loss-recovery-drill.mjs
 *
 * If DOCKER_REDIS_CONTAINER is set (default gridflex-redis), the script stops
 * and starts that container for the outage window. Otherwise it only probes
 * behaviour and records that operator must interrupt Redis externally.
 */
import { createHash, createHmac, randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const allow = process.env.REDIS_CHAOS_ALLOW === "true";
if (!allow) {
  console.error("Refusing to run without REDIS_CHAOS_ALLOW=true");
  process.exit(2);
}

const baseUrl = (process.env.BASE_URL || "http://127.0.0.1:4010").replace(/\/$/, "");
const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const container = process.env.DOCKER_REDIS_CONTAINER || "gridflex-redis";
const useDocker = process.env.REDIS_CHAOS_USE_DOCKER !== "false";
const outputFile =
  process.env.REDIS_CHAOS_OUTPUT ||
  path.resolve("go-live-reports", "redis-loss-recovery-drill.json");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const probeHealth = async () => {
  const started = Date.now();
  try {
    const res = await fetch(`${baseUrl}/api/health`);
    return { ok: res.ok, status: res.status, ms: Date.now() - started };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      ms: Date.now() - started,
      error: error instanceof Error ? error.message : String(error)
    };
  }
};

const b64url = (buf) =>
  Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const signedIngest = async () => {
  const deviceId = process.env.DEVICE_ID;
  const credentialId = process.env.DEVICE_CREDENTIAL_ID;
  const secretB64Url = process.env.DEVICE_SECRET_B64URL;
  const keyVersion = Number(process.env.DEVICE_KEY_VERSION || "1");
  if (!deviceId || !credentialId || !secretB64Url) {
    return { skipped: true, reason: "DEVICE_* not set" };
  }

  const bodyObj = {
    voltage: 230,
    current: 1,
    power: 0.2,
    timestamp: new Date().toISOString()
  };
  const body = JSON.stringify(bodyObj);
  const timestamp = String(Date.now());
  const nonce = randomBytes(12).toString("hex");
  const sequenceNumber = Date.now();
  const bodyHash = createHash("sha256").update(body).digest("hex");
  const canonical = [
    "GRIDFLEX-V1",
    deviceId,
    credentialId,
    String(keyVersion),
    timestamp,
    nonce,
    String(sequenceNumber),
    bodyHash
  ].join("\n");
  const secret = Buffer.from(secretB64Url.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  const signature = createHmac("sha256", secret).update(canonical).digest("base64url");

  const started = Date.now();
  try {
    const res = await fetch(`${baseUrl}/api/edge-data`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-gridflex-device-id": deviceId,
        "x-gridflex-credential-id": credentialId,
        "x-gridflex-key-version": String(keyVersion),
        "x-gridflex-timestamp": timestamp,
        "x-gridflex-nonce": nonce,
        "x-gridflex-sequence": String(sequenceNumber),
        "x-gridflex-signature": signature
      },
      body
    });
    return { skipped: false, status: res.status, ms: Date.now() - started, ok: res.status === 201 };
  } catch (error) {
    return {
      skipped: false,
      status: 0,
      ms: Date.now() - started,
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
};

const docker = (args) => {
  try {
    const out = execFileSync("docker", args, { encoding: "utf8" }).trim();
    return { ok: true, out };
  } catch (error) {
    return {
      ok: false,
      out: error instanceof Error ? error.message : String(error)
    };
  }
};

const main = async () => {
  const before = {
    health: await probeHealth(),
    ingest: await signedIngest()
  };

  let outageControl = { mode: "manual", note: "Operator must stop Redis externally" };
  if (useDocker) {
    const stop = docker(["stop", container]);
    outageControl = {
      mode: "docker-stop",
      container,
      stopOk: stop.ok,
      stopOut: stop.out
    };
  }

  await sleep(Number(process.env.REDIS_OUTAGE_MS || "3000"));

  const during = {
    health: await probeHealth(),
    ingest: await signedIngest()
  };

  let recoverControl = { mode: "manual" };
  if (useDocker) {
    const start = docker(["start", container]);
    recoverControl = {
      mode: "docker-start",
      container,
      startOk: start.ok,
      startOut: start.out
    };
    await sleep(Number(process.env.REDIS_RECOVER_WAIT_MS || "4000"));
  }

  const after = {
    health: await probeHealth(),
    ingest: await signedIngest()
  };

  const report = {
    schemaVersion: 1,
    mode: "redis-loss-recovery-drill",
    generatedAt: new Date().toISOString(),
    baseUrl,
    redisUrlRedacted: redisUrl.replace(/\/\/.*@/, "//***@"),
    outageControl,
    recoverControl,
    before,
    during,
    after,
    notes: [
      "Local drill only unless BASE_URL points at authorized staging.",
      "Accepted ingest during Redis outage should fail closed when EDGE_REPLAY_REQUIRE_REDIS=true.",
      "Physical execution must remain disabled."
    ]
  };

  await fs.mkdir(path.dirname(outputFile), { recursive: true });
  const body = `${JSON.stringify(report, null, 2)}\n`;
  await fs.writeFile(outputFile, body, "utf8");
  const sha = createHash("sha256").update(body).digest("hex");
  await fs.writeFile(`${outputFile}.sha256`, `${sha}  ${path.basename(outputFile)}\n`, "utf8");
  console.log(JSON.stringify({ outputFile, sha256: sha, duringIngestStatus: during.ingest.status }, null, 2));
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
