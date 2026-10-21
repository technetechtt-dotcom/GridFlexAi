jest.mock("../src/lib/prisma.js", () => ({
  prisma: {
    organisationMembership: { findMany: jest.fn() },
    siteMembership: { findMany: jest.fn() },
    user: { findUnique: jest.fn() },
    site: { findMany: jest.fn() },
    edgeNode: { findUnique: jest.fn() }
  }
}));

import { prisma } from "../src/lib/prisma.js";
import {
  getOptionalSiteAccessScope,
  resolveScopedSiteId,
  assertNodeSiteAccess
} from "../src/services/access-scope.service.js";
import { resolveAccessScope } from "../src/middleware/permissions.js";

const actor = { id: "operator-1", role: "operator" };
const mock = (fn: unknown) => fn as jest.Mock;

describe("shared service access scope", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mock(prisma.user.findUnique).mockResolvedValue({ siteId: null, site: null });
    mock(prisma.organisationMembership.findMany).mockResolvedValue([]);
    mock(prisma.siteMembership.findMany).mockResolvedValue([
      { siteId: "site-a", site: { organisationId: "org-1" } },
      { siteId: "site-b", site: { organisationId: "org-1" } }
    ]);
  });

  it("rejects missing or invalid identity before querying tenant data", async () => {
    await expect(getOptionalSiteAccessScope(undefined)).rejects.toMatchObject({ statusCode: 401 });
    await expect(getOptionalSiteAccessScope({ id: "", role: "admin" })).rejects.toThrow();
    await expect(getOptionalSiteAccessScope({ id: "x", role: "unknown" })).rejects.toThrow();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("includes all assigned sites and keeps explicit filters within scope", async () => {
    await expect(resolveScopedSiteId(actor, undefined)).resolves.toEqual({ in: ["site-a", "site-b"] });
    await expect(resolveScopedSiteId(actor, "site-b")).resolves.toBe("site-b");
    await expect(resolveScopedSiteId(actor, "site-c")).rejects.toThrow();
  });

  it("denies a sibling-site node even within the same organisation", async () => {
    mock(prisma.edgeNode.findUnique).mockResolvedValue({ siteId: "site-c" });
    await expect(assertNodeSiteAccess("node-c", actor)).rejects.toThrow();
    mock(prisma.edgeNode.findUnique).mockResolvedValue({ siteId: "site-b" });
    await expect(assertNodeSiteAccess("node-b", actor)).resolves.toBeUndefined();
  });

  it("expands organisation access to its sites without granting global scope", async () => {
    mock(prisma.siteMembership.findMany).mockResolvedValue([]);
    mock(prisma.organisationMembership.findMany).mockResolvedValue([{ organisationId: "org-1" }]);
    mock(prisma.site.findMany).mockResolvedValue([{ id: "site-a" }, { id: "site-b" }]);
    await expect(getOptionalSiteAccessScope(actor)).resolves.toEqual({ kind: "site", siteIds: ["site-a", "site-b"] });
    expect(prisma.site.findMany).toHaveBeenCalledWith({
      where: { organisationId: { in: ["org-1"] } }, select: { id: true }
    });
  });

  it("uses an empty filter for an organisation with no sites", async () => {
    mock(prisma.siteMembership.findMany).mockResolvedValue([]);
    mock(prisma.organisationMembership.findMany).mockResolvedValue([{ organisationId: "org-1" }]);
    mock(prisma.site.findMany).mockResolvedValue([]);
    await expect(resolveScopedSiteId(actor, undefined)).resolves.toEqual({ in: [] });
  });

  it("denies deleted users and accounts with no membership", async () => {
    mock(prisma.user.findUnique).mockResolvedValue(null);
    await expect(resolveAccessScope(actor.id, "operator")).resolves.toEqual({ kind: "none" });
    await expect(getOptionalSiteAccessScope(actor)).rejects.toThrow();
    mock(prisma.user.findUnique).mockResolvedValue({ siteId: null, site: null });
    mock(prisma.siteMembership.findMany).mockResolvedValue([]);
    await expect(getOptionalSiteAccessScope(actor)).rejects.toThrow();
  });

  it("retains explicit platform-admin access", async () => {
    await expect(getOptionalSiteAccessScope({ id: "admin-1", role: "admin" })).resolves.toEqual({ kind: "global" });
  });
});
