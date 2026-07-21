import request from "supertest";

import { createApp } from "../src/app.js";
import { loginUser, registerUser, rotateRefreshToken } from "../src/services/auth.service.js";

jest.mock("../src/services/auth.service.js", () => ({
  loginUser: jest.fn(),
  registerUser: jest.fn(),
  rotateRefreshToken: jest.fn(),
  revokeRefreshToken: jest.fn()
}));

const mockedRegister = registerUser as jest.MockedFunction<typeof registerUser>;
const mockedLogin = loginUser as jest.MockedFunction<typeof loginUser>;
const mockedRotate = rotateRefreshToken as jest.MockedFunction<typeof rotateRefreshToken>;

describe("Auth routes", () => {
  const app = createApp();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("registers user successfully", async () => {
    mockedRegister.mockResolvedValue({
      user: {
        id: "u1",
        email: "admin@gridflex.ai",
        name: "Admin",
        createdAt: new Date()
      },
      token: "access-token",
      refreshToken: "refresh-token"
    });

    const res = await request(app)
    .post("/api/auth/register")
    .send({
      name: "Admin",
      email: "admin@gridflex.ai",
      password: "Admin@12345"
    });

    expect(res.status).toBe(201);
    expect(res.body.token).toBe("access-token");
    expect(res.body.refreshToken).toBeUndefined();
    expect(res.headers["set-cookie"]?.[0]).toContain("gridflex_refresh_token=refresh-token");
  });

  it("validates login payload", async () => {
    const res = await request(app)
    .post("/api/auth/login")
    .send({
      email: "admin@gridflex.ai"
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("Request validation failed");
  });

  it("logs in user successfully", async () => {
    mockedLogin.mockResolvedValue({
      user: {
        id: "u1",
        email: "admin@gridflex.ai",
        name: "Admin",
        createdAt: new Date()
      },
      token: "access-token",
      refreshToken: "refresh-token"
    });

    const res = await request(app)
    .post("/api/auth/login")
    .send({
      email: "admin@gridflex.ai",
      password: "Admin@12345"
    });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("admin@gridflex.ai");
    expect(res.body.refreshToken).toBeUndefined();
    expect(res.headers["set-cookie"]?.[0]).toContain("gridflex_refresh_token=refresh-token");
  });

  it("rotates only the httpOnly refresh cookie", async () => {
    mockedRotate.mockResolvedValue({
      user: {
        id: "u1",
        email: "admin@gridflex.ai",
        name: "Admin",
        createdAt: new Date()
      },
      token: "new-access-token",
      refreshToken: "new-refresh-token"
    });

    const res = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", "gridflex_refresh_token=old-refresh-token")
      .send({});

    expect(res.status).toBe(200);
    expect(mockedRotate).toHaveBeenCalledWith("old-refresh-token");
    expect(res.body.token).toBe("new-access-token");
    expect(res.body.refreshToken).toBeUndefined();
    expect(res.headers["set-cookie"]?.[0]).toContain("gridflex_refresh_token=new-refresh-token");
  });

  it("rejects refresh tokens supplied in JSON", async () => {
    const res = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: "must-not-be-accepted-from-browser-storage" });

    expect(res.status).toBe(400);
    expect(mockedRotate).not.toHaveBeenCalled();
  });
});
