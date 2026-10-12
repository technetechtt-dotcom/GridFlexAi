/**
 * Warm Render frontend + backend before a live presentation.
 *
 *   npm run warmup:staging
 *   BASE_URL=https://gridflex-backend.onrender.com FRONTEND_URL=https://gridflex-frontend.onrender.com npm run warmup:staging
 */
const baseUrl = (process.env.BASE_URL || "https://gridflex-backend.onrender.com").replace(/\/$/, "");
const frontendUrl = (process.env.FRONTEND_URL || "https://gridflex-frontend.onrender.com").replace(/\/$/, "");

const get = async (url) => {
  const started = Date.now();
  const res = await fetch(url, { headers: { Accept: "text/html,application/json" } });
  const ms = Date.now() - started;
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text.slice(0, 120);
  }
  return { url, status: res.status, ms, body };
};

const main = async () => {
  console.log(`Warming backend ${baseUrl}`);
  for (const path of ["/api/health/live", "/api/health", "/api/operating-mode"]) {
    try {
      console.log(JSON.stringify(await get(`${baseUrl}${path}`), null, 2));
    } catch (err) {
      console.error(`FAIL ${path}:`, err instanceof Error ? err.message : err);
      process.exitCode = 1;
    }
  }

  console.log(`Warming frontend ${frontendUrl}`);
  for (const path of ["/", "/login", "/product-info", "/gcip"]) {
    try {
      const result = await get(`${frontendUrl}${path}`);
      console.log(JSON.stringify({ url: result.url, status: result.status, ms: result.ms }, null, 2));
    } catch (err) {
      console.error(`FAIL frontend ${path}:`, err instanceof Error ? err.message : err);
      process.exitCode = 1;
    }
  }

  const health = await get(`${baseUrl}/api/health`).catch(() => null);
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
