import type { MembershipRole, Role } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";

import { prisma } from "../lib/prisma.js";
import { recordAuditLog } from "../services/audit-log.service.js";
import { AppError } from "../utils/AppError.js";

export type AccessScope =
  | { kind: "global"; reason: "platform_admin" }
  | { kind: "organisation"; organisationIds: string[] }
  | { kind: "site"; siteIds: string[]; organisationIds: string[] }
  | { kind: "none" };

const PLATFORM_ROLES: Role[] = ["admin", "developer"];

export const isPlatformAdminRole = (role: Role | undefined): boolean =>
  Boolean(role && PLATFORM_ROLES.includes(role));

export const resolveAccessScope = async (userId: string, role: Role): Promise<AccessScope> => {
  if (isPlatformAdminRole(role)) {
    return { kind: "global", reason: "platform_admin" };
  }

  const [orgMemberships, siteMemberships, user] = await Promise.all([
    prisma.organisationMembership.findMany({
      where: { userId, status: "active" },
      select: { organisationId: true }
    }),
    prisma.siteMembership.findMany({
      where: { userId, status: "active" },
      select: {
        siteId: true,
        site: { select: { organisationId: true } }
      }
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        siteId: true,
        site: { select: { organisationId: true } }
      }
    })
  ]);

  const organisationIds = new Set(orgMemberships.map((row) => row.organisationId));
  const siteIds = new Set(siteMemberships.map((row) => row.siteId));

  for (const membership of siteMemberships) {
    if (membership.site.organisationId) {
      organisationIds.add(membership.site.organisationId);
    }
  }

  if (user?.siteId) {
    siteIds.add(user.siteId);
    if (user.site?.organisationId) {
      organisationIds.add(user.site.organisationId);
    }
  }

  if (siteIds.size > 0) {
    return {
      kind: "site",
      siteIds: [...siteIds],
      organisationIds: [...organisationIds]
    };
  }

  if (organisationIds.size > 0) {
    return {
      kind: "organisation",
      organisationIds: [...organisationIds]
    };
  }

  return { kind: "none" };
};

export const assertSiteAccess = async (
  scope: AccessScope,
  siteId: string | null | undefined
): Promise<void> => {
  if (!siteId) {
    throw new AppError("Site scope is required.", 400);
  }
  if (scope.kind === "global") return;
  if (scope.kind === "site" && scope.siteIds.includes(siteId)) return;

  if (scope.kind === "organisation" || scope.kind === "site") {
    const site = await prisma.site.findUnique({
      where: { id: siteId },
      select: { organisationId: true }
    });
    if (site?.organisationId && scope.organisationIds.includes(site.organisationId)) {
      // Organisation portfolio admins may access sites under their orgs.
      if (scope.kind === "organisation") return;
    }
  }

  throw new AppError("Cross-tenant site access denied.", 403);
};

export const assertOrganisationAccess = (
  scope: AccessScope,
  organisationId: string | null | undefined
): void => {
  if (!organisationId) {
    throw new AppError("Organisation scope is required.", 400);
  }
  if (scope.kind === "global") return;
  if (
    (scope.kind === "organisation" || scope.kind === "site") &&
    scope.organisationIds.includes(organisationId)
  ) {
    return;
  }
  throw new AppError("Cross-tenant organisation access denied.", 403);
};

export const loadRequestAccessScope = async (req: Request): Promise<AccessScope> => {
  if (!req.user) {
    throw new AppError("Authentication required.", 401);
  }
  if (req.accessScope) {
    return req.accessScope;
  }
  const scope = await resolveAccessScope(req.user.id, req.user.role as Role);
  req.accessScope = scope;
  return scope;
};

export const requireMembershipRoles =
  (...roles: MembershipRole[]) =>
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        next(new AppError("Authentication required.", 401));
        return;
      }

      if (isPlatformAdminRole(req.user.role as Role)) {
        await recordAuditLog({
          action: "access.super_admin.bypass",
          entityType: "Permission",
          message: `Platform admin ${req.user.email} accessed membership-scoped route`,
          userId: req.user.id
        });
        next();
        return;
      }

      const membership = await prisma.organisationMembership.findFirst({
        where: {
          userId: req.user.id,
          status: "active",
          ...(roles.length > 0 ? { role: { in: roles } } : {})
        }
      });

      if (!membership) {
        next(new AppError("Insufficient organisation permissions.", 403));
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };

export const attachAccessScope = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await loadRequestAccessScope(req);
    next();
  } catch (error) {
    next(error);
  }
};
