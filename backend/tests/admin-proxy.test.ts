import express from "express";
import request from "supertest";

jest.mock("../src/config/env.js", () => ({ env: {
  ADMIN_ALLOWED_IPS: "198.51.100.10",
  ADMIN_ALLOWED_EMAILS: "admin@gridflex.ai",
  ADMIN_REQUIRE_HTTPS: false,
  ADMIN_MAX_TOKEN_AGE_MINUTES: 15
} }));
jest.mock("../src/utils/jwt.js", () => ({ verifyAccessToken: jest.fn() }));

import { env } from "../src/config/env.js";
import { authorizeRoles } from "../src/middleware/auth.js";

const appFor = (trustProxy: boolean | number) => {
  const app = express();
  app.set("trust proxy", trustProxy);
  app.use((req, _res, next) => {
    req.user = { id: "admin", email: "admin@gridflex.ai", name: "Admin", role: "admin", tokenIssuedAt: Math.floor(Date.now() / 1000) };
    next();
  });
  app.get("/admin", authorizeRoles("admin"), (_req, res) => { res.sendStatus(200); });
  app.use((error: { statusCode?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.sendStatus(error.statusCode ?? 500);
  });
  return app;
};

describe("admin proxy boundary", () => {
  afterEach(() => { env.ADMIN_REQUIRE_HTTPS = false; });

  it("ignores a caller's forwarding header when proxies are untrusted", async () => {
    expect((await request(appFor(false)).get("/admin").set("X-Forwarded-For", "198.51.100.10")).status).toBe(403);
  });

  it("uses the proxy-resolved client rather than the spoofable leftmost address", async () => {
    expect((await request(appFor(1)).get("/admin").set("X-Forwarded-For", "198.51.100.10, 203.0.113.5")).status).toBe(403);
    expect((await request(appFor(1)).get("/admin").set("X-Forwarded-For", "203.0.113.5, 198.51.100.10")).status).toBe(200);
  });

  it("accepts forwarded HTTPS only through the configured trusted proxy", async () => {
    env.ADMIN_REQUIRE_HTTPS = true;
    expect((await request(appFor(false)).get("/admin").set("X-Forwarded-Proto", "https").set("X-Forwarded-For", "198.51.100.10")).status).toBe(403);
    expect((await request(appFor(1)).get("/admin").set("X-Forwarded-Proto", "https").set("X-Forwarded-For", "198.51.100.10")).status).toBe(200);
  });
});
