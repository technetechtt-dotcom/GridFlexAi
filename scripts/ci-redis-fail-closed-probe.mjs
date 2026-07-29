/**
 * CI probe: Redis up → SET NX OK; SHUTDOWN → subsequent SET fails.
 * Evidence that production EDGE_REPLAY_REQUIRE_REDIS fail-closed depends on Redis.
 *
 * Env:
 *   REDIS_URL (default redis://127.0.0.1:6379)
 *   CI_EVIDENCE_OUTPUT (default ci-evidence/redis-chaos/probe.json)
 */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(__dirname, "../backend/package.json"));
const Redis = require("ioredis");

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const outFile =
  process.env.CI_EVIDENCE_OUTPUT ||
  path.resolve("ci-evidence", "redis-chaos", "probe.json");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const makeClient = () =>
  new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 3000,
    retryStrategy: () => null
  });

const safeClose = async (client) => {
  if (!client) return;
  try {
    const result = client.quit();
    if (result && typeof result.then === "function") {
      await result.catch(() => undefined);
    }
  } catch {
    try {
      client.disconnect(false);
    } catch {
      // ignore
    }
  }
};

const main = async () => {
  const evidence = {
    startedAt: new Date().toISOString(),
    redisUrl,
    method: "SHUTDOWN NOSAVE",
    phases: {}
  };

  const client = makeClient();

  try {
    await client.connect();
    const key = `ci:replay-probe:${Date.now()}`;
    const setOk = await client.set(key, "1", "EX", 30, "NX");
    evidence.phases.beforeOutage = { redisReady: true, setNx: setOk };
    if (setOk !== "OK") {
      throw new Error(`Expected SET NX OK before outage, got ${String(setOk)}`);
    }

    // Kill the Redis server process (works against GHA service containers).
    try {
      await client.shutdown("NOSAVE");
      evidence.phases.stopRedis = { ok: true, via: "SHUTDOWN NOSAVE" };
    } catch (error) {
      // SHUTDOWN often closes the connection abruptly; treat that as success.
      evidence.phases.stopRedis = {
        ok: true,
        via: "SHUTDOWN NOSAVE",
        note: error instanceof Error ? error.message : String(error)
      };
    }

    await safeClose(client);
    await sleep(1000);

    const dead = makeClient();
    try {
      await dead.connect();
      const unexpected = await dead.set(`ci:replay-probe:down:${Date.now()}`, "1", "EX", 10, "NX");
      evidence.phases.duringOutage = { unexpectedSuccess: true, setNx: unexpected };
    } catch (error) {
      evidence.phases.duringOutage = {
        failClosed: true,
        error: error instanceof Error ? error.message : String(error)
      };
    } finally {
      await safeClose(dead);
    }

    if (!evidence.phases.duringOutage?.failClosed) {
      throw new Error("Expected Redis operations to fail during outage (fail-closed probe).");
    }

    evidence.pass = true;
    evidence.completedAt = new Date().toISOString();
  } catch (error) {
    evidence.pass = false;
    evidence.error = error instanceof Error ? error.message : String(error);
    evidence.completedAt = new Date().toISOString();
    await safeClose(client);
  }

  await fs.mkdir(path.dirname(outFile), { recursive: true });
  await fs.writeFile(outFile, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(evidence, null, 2));
  if (!evidence.pass) {
    process.exit(1);
  }
};

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
