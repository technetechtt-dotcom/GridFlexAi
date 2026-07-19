import { resolveAccessScope, assertOrganisationAccess } from "../src/middleware/permissions";
import { AppError } from "../src/utils/AppError";

jest.mock("../src/lib/prisma.js", () => ({
  prisma: {
    organisationMembership: {
      findMany: jest.fn(async () => [{ organisationId: "org-a" }])
    },
    siteMembership: {
      findMany: jest.fn(async () => [])
    },
    user: {
      findUnique: jest.fn(async () => ({ siteId: null, site: null }))
    },
    site: {
      findUnique: jest.fn(async () => ({ organisationId: "org-b" }))
    }
  }
}));

describe("tenant access scope", () => {
  it("scopes non-admin users to their organisation memberships", async () => {
    const scope = await resolveAccessScope("user-1", "manager");
    expect(scope.kind).toBe("organisation");
    if (scope.kind === "organisation") {
      expect(scope.organisationIds).toContain("org-a");
    }
  });

  it("denies cross-organisation access", async () => {
    const scope = await resolveAccessScope("user-1", "operator");
    expect(() => assertOrganisationAccess(scope, "org-other")).toThrow(AppError);
  });

  it("allows platform admins globally", async () => {
    const scope = await resolveAccessScope("admin-1", "admin");
    expect(scope).toEqual({ kind: "global", reason: "platform_admin" });
    expect(() => assertOrganisationAccess(scope, "any-org")).not.toThrow();
  });
});
