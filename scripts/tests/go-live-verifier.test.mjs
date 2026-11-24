import assert from "node:assert/strict";
import { test, afterEach } from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { runGoLiveVerification } from "../lib/go-live-verifier.mjs";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const config = {
  baseUrl: "https://api.example.test", requireReleaseIdentity: true,
  expectedGitSha: "a".repeat(40), expectedImageDigest: `sha256:${"b".repeat(64)}`
};
const healthy = () => ({ status: "ok", release: { gitSha: config.expectedGitSha, imageDigest: config.expectedImageDigest },
  dependencies: { database: "up", redis: "up" }, safety: { operatingMode: "PILOT_LIVE",
    pilotLockPhysicalExecution: true, physicalCommandExecutionEnabled: false, hilPlantApprovalConfirmed: false } });
test("standalone signer uses the API's millisecond clock and accepts an environment secret", () => {
  const started = Date.now();
  const result = spawnSync(process.execPath, [fileURLToPath(new URL("../../load/sign-gridflex-v1.mjs", import.meta.url)),
    "--device", "fixture-device", "--credential", "fixture-credential", "--body", fileURLToPath(import.meta.url)], {
    encoding: "utf8", env: { ...process.env, DEVICE_SECRET_B64URL: Buffer.alloc(32, 1).toString("base64url") }
  });
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  const timestamp = Number(output.headers["x-gridflex-timestamp"]);
  assert.ok(timestamp >= started && timestamp <= Date.now());
  assert.ok(output.headers["x-gridflex-signature"]);
});
const mockHealth = (health) => {
  globalThis.fetch = async (url) => new Response(JSON.stringify(health), { status: url.endsWith("/nodes") ? 401 : 200 });
};
test("accepts only the expected locked release with healthy dependencies", async () => {
  mockHealth(healthy());
  assert.ok((await runGoLiveVerification(config)).every((check) => check.ok));
});
test("rejects a different deployed image", async () => {
  const health = healthy(); health.release.imageDigest = `sha256:${"c".repeat(64)}`;
  mockHealth(health);
  await assert.rejects(runGoLiveVerification(config), (error) => {
    assert.match(error.message, /does not match/);
    assert.equal(error.checks.at(-1).ok, false);
    return true;
  });
});
test("rejects unavailable Redis even if health claims ok", async () => {
  const health = healthy(); health.dependencies.redis = "down"; mockHealth(health);
  await assert.rejects(runGoLiveVerification(config), /Redis must both be up/);
});
test("rejects armed plant control", async () => {
  const health = healthy(); health.safety.physicalCommandExecutionEnabled = true; mockHealth(health);
  await assert.rejects(runGoLiveVerification(config), /physical execution locked/);
});
test("refresh verification supplies the configured frontend origin", async () => {
  globalThis.fetch = async (url, options) => {
    if (url.endsWith("/login")) return new Response(JSON.stringify({ token: "access" }), {
      status: 200, headers: { "set-cookie": "gridflex_refresh_token=opaque; HttpOnly; Secure; Path=/api/auth" }
    });
    if (url.endsWith("/refresh")) {
      assert.equal(options.headers.Origin, "https://app.example.test");
      assert.equal(options.headers.Cookie, "gridflex_refresh_token=opaque");
      return new Response(JSON.stringify({ token: "rotated" }), { status: 200 });
    }
    return new Response(JSON.stringify(healthy()), { status: 200 });
  };
  await runGoLiveVerification({ ...config, requireAuthFlow: true, email: "test@example.test",
    password: "test-only", frontendOrigin: "https://app.example.test" });
});
