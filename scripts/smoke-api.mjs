const baseUrl = process.env.SMOKE_API_BASE_URL ?? "https://localhost:4443";

const check = async (name, path, expectedStatus, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, options);
  const bodyText = await response.text();
  if (response.status !== expectedStatus) {
    throw new Error(`${name} failed: expected ${expectedStatus}, got ${response.status}. Body: ${bodyText}`);
  }
  return bodyText;
};

const main = async () => {
  if (process.env.SMOKE_SKIP_TLS_VERIFY === "true") {
    console.warn(
      "SMOKE_SKIP_TLS_VERIFY is ignored; TLS certificate validation remains enforced."
    );
  }
  await check("liveness", "/api/health/live", 200);
  const healthRaw = await check("health", "/api/health", 200);
  const health = JSON.parse(healthRaw);
  if (health.status !== "ok") {
    throw new Error(`Health payload invalid: ${healthRaw}`);
  }
  await check("auth guard", "/api/nodes", 401);
  // eslint-disable-next-line no-console
  console.log(`Smoke API checks passed against ${baseUrl}`);
};

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
