/**
 * Warm staging (or any BASE_URL) before a live presentation.
 *
 *   npm run warmup:staging
 *   BASE_URL=https://gridflex-backend.onrender.com npm run warmup:staging
 */
const baseUrl = (process.env.BASE_URL || "https://gridflex-backend.onrender.com").replace(/\/$/, "");

const get = async (path) => {
  const url = `${baseUrl}${path}`;
  const started = Date.now();
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  const ms = Date.now() - started;
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text.slice(0, 200);
  }
  return { url, status: res.status, ms, body };
};

const main = async () => {
  console.log(`Warming ${baseUrl}`);
  const paths = ["/api/health/live", "/api/health", "/api/operating-mode"];
  for (const path of paths) {
    try {
      const result = await get(path);
      console.log(JSON.stringify(result, null, 2));
    } catch (err) {
      console.error(`FAIL ${path}:`, err instanceof Error ? err.message : err);
      process.exitCode = 1;
    }
  }

  const health = await get("/api/health").catch(() => null);
  if (health?.body?.release) {
    const { gitSha, imageDigest } = health.body.release;
    if (!gitSha || !imageDigest) {
      console.warn(
        "WARNING: release.gitSha/imageDigest null — host is not digest-pinned. Say this honestly in the demo."
      );
    } else {
      console.log(`Release identity OK: ${gitSha} @ ${imageDigest}`);
    }
  }
};

main();
