/**
 * CI probe: Redis up → SET NX OK; stop Redis → subsequent SET fails.
 * Evidence that production EDGE_REPLAY_REQUIRE_REDIS fail-closed depends on Redis.
 *
 * Env:
 *   REDIS_URL (default redis://127.0.0.1:6379)
 *   REDIS_CHAOS_USE_DOCKER (default true)
 *   CI_EVIDENCE_OUTPUT (default ci-evidence/redis-chaos/probe.json)
 */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(__dirname, "../backend/package.json"));
const Redis = require("ioredis");

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const useDocker = process.env.REDIS_CHAOS_USE_DOCKER !== "false";
const outFile =
  process.env.CI_EVIDENCE_OUTPUT ||
  path.resolve("ci-evidence", "redis-chaos", "probe.json");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const docker = (args) => {
  try {
    const out = execFileSync("docker", args, { encoding: "utf8" }).trim();
    return { ok: true, out };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
};

const stopRedisContainer = () => {
  for (const ancestor of ["redis:7-alpine", "redis:7", "redis"]) {
    const listed = docker(["ps", "--filter", `ancestor=${ancestor}`, "--format", "{{.ID}}"]);
    if (listed.ok && listed.out) {
      const id = listed.out.split("\n").find(Boolean);
      if (id) {
        return { ...docker(["stop", id]), id, ancestor };
      }
    }
  }
  return { ok: false, error: "No redis service container found to stop" };
};

const main = async () => {
  const evidence = {
    startedAt: new Date().toISOString(),
    redisUrl,
    useDocker,
    phases: {}
  };

  const client = new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 2000
  });

  try {
    await client.connect();
    const key = `ci:replay-probe:${Date.now()}`;
    const setOk = await client.set(key, "1", "EX", 30, "NX");
    evidence.phases.beforeOutage = { redisReady: true, setNx: setOk };

    if (useDocker) {
      const stopped = stopRedisContainer();
      evidence.phases.stopRedis = stopped;
      if (!stopped.ok) {
        throw new Error(`Failed to stop Redis container: ${stopped.error || "unknown"}`);
      }
      await sleep(1500);
    } else {
      evidence.phases.stopRedis = { skipped: true, reason: "REDIS_CHAOS_USE_DOCKER=false" };
    }

    await client.disconnect().catch(() => undefined);
    const dead = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 1500,
      retryStrategy: () => null
    });

    try {
      await dead.connect();
      await dead.set(`ci:replay-probe:down:${Date.now()}`, "1", "EX", 10, "NX");
      evidence.phases.duringOutage = { unexpectedSuccess: true };
    } catch (error) {
      evidence.phases.duringOutage = {
        failClosed: true,
        error: error instanceof Error ? error.message : String(error)
      };
    } finally {
      await dead.quit().catch(() => dead.disconnect());
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
  } finally {
    await client.quit().catch(() => client.disconnect());
  }

  await fs.mkdir(path.dirname(outFile), { recursive: true });
  await fs.writeFile(outFile, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(evidence, null, 2));
  if (!evidence.pass) {
    process.exit(1);
  }
};

main();
