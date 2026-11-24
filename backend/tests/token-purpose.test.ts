import jwt from "jsonwebtoken";
import { env } from "../src/config/env.js";
import { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken } from "../src/utils/jwt.js";
import { authenticate } from "../src/middleware/auth.js";
import { authenticateSocket } from "../src/lib/socket-rooms.js";
import type { Request, Response } from "express";
import type { Socket } from "socket.io";

const payload = { sub: "user-1", email: "admin@gridflex.ai", name: "Admin", role: "admin" as const };

describe("JWT purpose separation", () => {
  it("accepts each token only at its intended verifier", () => {
    const access = signAccessToken(payload);
    const refresh = signRefreshToken(payload);
    expect(verifyAccessToken(access).sub).toBe(payload.sub);
    expect(verifyRefreshToken(refresh).sub).toBe(payload.sub);
    expect(() => verifyAccessToken(refresh)).toThrow();
    expect(() => verifyRefreshToken(access)).toThrow();
  });

  it("rejects a refresh token at HTTP and socket access gates", () => {
    const refresh = signRefreshToken(payload);
    const next = jest.fn();
    authenticate({ headers: { authorization: `Bearer ${refresh}` } } as Request, {} as Response, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
    const socketNext = jest.fn();
    authenticateSocket({ handshake: { auth: { token: refresh }, headers: {} }, data: {} } as unknown as Socket, socketNext);
    expect(socketNext).toHaveBeenCalledWith(expect.any(Error));
  });

  it("issues unique refresh credentials even for simultaneous logins", () => {
    expect(signRefreshToken(payload)).not.toBe(signRefreshToken(payload));
  });

  it("rejects legacy tokens without an explicit purpose", () => {
    const legacy = jwt.sign(payload, env.JWT_SECRET, { expiresIn: "15m", algorithm: "HS256" });
    expect(() => verifyAccessToken(legacy)).toThrow();
    expect(() => verifyRefreshToken(legacy)).toThrow();
  });

  it("rejects signed access tokens with missing expiry or invalid identity claims", () => {
    const noExpiry = jwt.sign({ ...payload, tokenUse: "access" }, env.JWT_SECRET);
    expect(() => verifyAccessToken(noExpiry)).toThrow();
    const noIdentity = jwt.sign({ ...payload, sub: "", tokenUse: "access" }, env.JWT_SECRET, { expiresIn: "15m" });
    expect(() => verifyAccessToken(noIdentity)).toThrow();
  });
});
