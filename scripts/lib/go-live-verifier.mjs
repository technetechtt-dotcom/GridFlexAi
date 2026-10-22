const assertStatus = async (baseUrl, results, name, path, expectedStatus, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, { ...options, signal: AbortSignal.timeout(15_000), redirect: "error" });
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
    throw new Error(`${name} failed: expected ${expectedStatus}, got ${response.status}`);
  }
  return bodyText;
};

const runAuthFlow = async (baseUrl, results, config) => {
  const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    signal: AbortSignal.timeout(15_000),
    redirect: "error",
    body: JSON.stringify({ email: config.email, password: config.password })
  });
  const loginRaw = await loginResponse.text();
  results.push({
    name: "login",
    path: "/api/auth/login",
    expectedStatus: 200,
    actualStatus: loginResponse.status,
    ok: loginResponse.status === 200
  });
  if (loginResponse.status !== 200) {
    throw new Error(`login failed: expected 200, got ${loginResponse.status}`);
  }
  const login = JSON.parse(loginRaw);
  const token = login?.token;
  if (typeof token !== "string" || !token) {
    throw new Error("Login response does not contain a token.");
  }
  if ("refreshToken" in login) {
    throw new Error("Login response leaked a refresh token in the JSON body.");
  }

  const setCookie = loginResponse.headers.get("set-cookie") ?? "";
  const refreshCookie = setCookie.split(";")[0];
  if (!refreshCookie.startsWith("gridflex_refresh_token=")) {
    throw new Error("Login response did not set the httpOnly refresh cookie.");
  }
  if (!/;\s*HttpOnly/i.test(setCookie) || !/;\s*Secure/i.test(setCookie)) {
    throw new Error("Production refresh cookie is missing HttpOnly or Secure.");
  }

  const refreshRaw = await assertStatus(baseUrl, results, "refresh cookie rotation", "/api/auth/refresh", 200, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: config.frontendOrigin ?? new URL(baseUrl).origin,
      Cookie: refreshCookie
    },
    body: "{}"
  });
  const refreshed = JSON.parse(refreshRaw);
  if (typeof refreshed?.token !== "string" || "refreshToken" in refreshed) {
    throw new Error("Refresh response must return an access token without exposing a refresh token.");
  }

  const authHeaders = {
    Authorization: `Bearer ${refreshed.token}`
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

const runChecks = async (config, results) => {
  const target = new URL(config.baseUrl);

  if (target.protocol !== "https:") {
    throw new Error("Go-live verification requires an HTTPS base URL.");
  }
  if (target.username || target.password) throw new Error("Base URL must not contain credentials.");
  if (config.requireReleaseIdentity && (!/^[a-f0-9]{40}$/i.test(config.expectedGitSha ?? "") ||
      !/^sha256:[a-f0-9]{64}$/i.test(config.expectedImageDigest ?? ""))) {
    throw new Error("Expected full release commit SHA and image digest are required.");
  }

  if (config.skipTlsVerify) {
    // Never disable TLS certificate validation (even on loopback).
    // GO_LIVE_SKIP_TLS_VERIFY is accepted for compatibility but ignored.
    console.warn(
      "GO_LIVE_SKIP_TLS_VERIFY is ignored; TLS certificate validation remains enforced."
    );
  }

  await assertStatus(config.baseUrl, results, "liveness", "/api/health/live", 200);
  const healthRaw = await assertStatus(config.baseUrl, results, "health", "/api/health", 200);
  const health = JSON.parse(healthRaw);
  if (health.status !== "ok") {
    throw new Error("Health payload did not report status ok.");
  }

  if (config.requireReleaseIdentity) {
    const releaseOk = health.release?.gitSha?.toLowerCase() === config.expectedGitSha.toLowerCase() &&
      health.release?.imageDigest?.toLowerCase() === config.expectedImageDigest.toLowerCase();
    results.push({ name: "expected release identity", ok: releaseOk });
    if (!releaseOk) throw new Error("Deployed release does not match the expected commit and image digest.");
    const dependenciesOk = health.dependencies?.database === "up" && health.dependencies?.redis === "up";
    results.push({ name: "required dependencies", ok: dependenciesOk });
    if (!dependenciesOk) throw new Error("Database and Redis must both be up.");
    const safety = health.safety;
    const locked = safety?.pilotLockPhysicalExecution === true &&
      safety.physicalCommandExecutionEnabled === false && safety.hilPlantApprovalConfirmed === false &&
      ["PILOT_LIVE", "PRODUCTION_ADVISORY"].includes(safety.operatingMode);
    results.push({ name: "telemetry-only execution lock", ok: locked });
    if (!locked) throw new Error("Telemetry pilot requires a live advisory mode and physical execution locked.");
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

export const runGoLiveVerification = async (config) => {
  const results = [];
  try { return await runChecks(config, results); }
  catch (error) {
    const failure = error instanceof Error ? error : new Error("Go-live verification failed.");
    failure.checks = results;
    throw failure;
  }
};
