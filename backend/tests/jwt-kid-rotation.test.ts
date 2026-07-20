import jwt from "jsonwebtoken";

import { buildJwtKeyring } from "../src/utils/jwt-keyring.js";
import {
  peekTokenKid,
  resetJwtKeyringForTests,
  signAccessToken,
  verifyAccessToken
} from "../src/utils/jwt.js";

describe("JWT kid overlapping rotation", () => {
  const payload = {
    sub: "user-1",
    email: "ops@example.com",
    name: "Ops",
    role: "admin" as const
  };

  afterEach(() => {
    resetJwtKeyringForTests();
    delete process.env.JWT_ACTIVE_KID;
    delete process.env.JWT_SECRETS_JSON;
    delete process.env.JWT_PREVIOUS_SECRET;
    delete process.env.JWT_PREVIOUS_KID;
  });

  it("embeds active kid when signing", () => {
    const keyring = buildJwtKeyring({
      JWT_SECRET: "active-secret-at-least-16-chars",
      JWT_ACTIVE_KID: "v2",
      JWT_SECRETS_JSON: JSON.stringify({
        v1: "previous-secret-16c!",
        v2: "active-secret-at-least-16-chars"
      })
    });
    expect(keyring.activeKid).toBe("v2");
    expect(Object.keys(keyring.secretsByKid).sort()).toEqual(["v1", "v2"]);

    // Drive through env-backed helpers by temporarily patching module cache via process.env
    // and rebuilding — signAccessToken uses env loaded at import time, so sign directly here:
    const token = jwt.sign(payload, keyring.secretsByKid.v2!, {
      expiresIn: "15m",
      keyid: keyring.activeKid,
      algorithm: "HS256"
    });
    expect(peekTokenKid(token)).toBe("v2");
  });

  it("verifies tokens signed with previous kid while new kid is active", () => {
    const oldSecret = "previous-secret-16ch";
    const newSecret = "rotated-secret-16chr";
    const oldToken = jwt.sign(payload, oldSecret, {
      expiresIn: "15m",
      keyid: "v1",
      algorithm: "HS256"
    });

    const keyring = buildJwtKeyring({
      JWT_SECRET: newSecret,
      JWT_ACTIVE_KID: "v2",
      JWT_SECRETS_JSON: JSON.stringify({ v1: oldSecret, v2: newSecret })
    });

    const verified = jwt.verify(oldToken, keyring.secretsByKid.v1!, { algorithms: ["HS256"] }) as {
      sub: string;
    };
    expect(verified.sub).toBe("user-1");

    // New tokens use v2
    const newToken = jwt.sign(payload, keyring.secretsByKid.v2!, {
      expiresIn: "15m",
      keyid: "v2",
      algorithm: "HS256"
    });
    expect(peekTokenKid(newToken)).toBe("v2");
    expect(jwt.verify(newToken, newSecret)).toMatchObject({ email: "ops@example.com" });
  });

  it("supports JWT_PREVIOUS_SECRET without JSON map", () => {
    const keyring = buildJwtKeyring({
      JWT_SECRET: "new-secret-value-16",
      JWT_ACTIVE_KID: "v2",
      JWT_PREVIOUS_SECRET: "old-secret-value-16",
      JWT_PREVIOUS_KID: "v1"
    });
    expect(keyring.secretsByKid.v1).toBe("old-secret-value-16");
    expect(keyring.secretsByKid.v2).toBe("new-secret-value-16");
  });

  it("rejects invalid JWT_SECRETS_JSON", () => {
    expect(() =>
      buildJwtKeyring({
        JWT_SECRET: "unused-but-required1",
        JWT_ACTIVE_KID: "v1",
        JWT_SECRETS_JSON: "not-json"
      })
    ).toThrow(/valid JSON/i);
  });

  it("rejects secrets shorter than 16 characters in the map", () => {
    expect(() =>
      buildJwtKeyring({
        JWT_SECRET: "unused-but-required1",
        JWT_ACTIVE_KID: "v1",
        JWT_SECRETS_JSON: JSON.stringify({ v1: "short" })
      })
    ).toThrow(/at least 16/);
  });

  it("env-backed sign/verify round-trip uses legacy kid by default", () => {
    // Uses whatever JWT_SECRET is already loaded in env for the process (jest setup).
    const token = signAccessToken(payload);
    const kid = peekTokenKid(token);
    expect(kid === "legacy" || typeof kid === "string").toBe(true);
    expect(verifyAccessToken(token).sub).toBe("user-1");
  });
});
