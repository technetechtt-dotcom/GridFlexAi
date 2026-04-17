const assertStatus = async (baseUrl, results, name, path, expectedStatus, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, options);
  const bodyText = await response.text();
  const ok = response.status === expectedStatus;
  results.push({
    name,
    path,
    expectedStatus,
    actualStatus: response.status,
    ok
  });
  if (!ok) {
    throw new Error(`${name} failed: expected ${expectedStatus}, got ${response.status}. Body: ${bodyText}`);
  }
  return bodyText;
};

const runAuthFlow = async (baseUrl, results, config) => {
  const loginRaw = await assertStatus(baseUrl, results, "login", "/api/auth/login", 200, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email: config.email, password: config.password })
  });
  const login = JSON.parse(loginRaw);
  const token = login?.token;
  if (typeof token !== "string" || !token) {
    throw new Error("Login response does not contain a token.");
  }

  const authHeaders = {
    Authorization: `Bearer ${token}`
  };

  await assertStatus(baseUrl, results, "authenticated nodes", "/api/nodes", 200, {
    headers: authHeaders
  });
  await assertStatus(baseUrl, results, "forecast providers status", "/api/forecast/providers/status", 200, {
    headers: authHeaders
  });
  await assertStatus(
    baseUrl,
    results,
    "forecast query",
    `/api/forecast?lat=${config.lat}&lon=${config.lon}&capacity=${config.capacity}`,
    200,
    {
      headers: authHeaders
    }
  );
  await assertStatus(baseUrl, results, "readings list", "/api/readings?limit=5&sort=desc", 200, {
    headers: authHeaders
  });
};

export const runGoLiveVerification = async (config) => {
  const results = [];

  if (config.skipTlsVerify) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  }

  await assertStatus(config.baseUrl, results, "liveness", "/api/health/live", 200);
  const healthRaw = await assertStatus(config.baseUrl, results, "health", "/api/health", 200);
  const health = JSON.parse(healthRaw);
  if (health.status !== "ok") {
    throw new Error(`Health payload invalid: ${healthRaw}`);
  }

  if (config.requireAuthFlow) {
    if (!config.email || !config.password) {
      throw new Error("GO_LIVE_EMAIL and GO_LIVE_PASSWORD are required for full verification.");
    }
    await runAuthFlow(config.baseUrl, results, config);
  } else if (config.email && config.password) {
    await runAuthFlow(config.baseUrl, results, config);
  } else {
    await assertStatus(config.baseUrl, results, "auth guard", "/api/nodes", 401);
  }

  return results;
};
