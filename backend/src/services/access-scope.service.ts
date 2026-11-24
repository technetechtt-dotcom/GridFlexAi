import { Role, type Prisma } from "@prisma/client";
import { resolveAccessScope } from "../middleware/permissions.js";

import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/AppError.js";

export type AccessActor = {
  id: string;
  role: string;
};

export type SiteAccessScope =
  | { kind: "global" }
  | { kind: "site"; siteIds: string[] };

export const isGlobalAccessRole = (role: string | undefined): boolean =>
  role === Role.admin || role === Role.developer;

export const getSiteAccessScope = async (actor: AccessActor | undefined): Promise<SiteAccessScope> => {
  if (!actor?.id || !Object.values(Role).includes(actor.role as Role)) {
    throw new AppError("Authentication required.", 401);
  }

  const scope = await resolveAccessScope(actor.id, actor.role as Role);
  if (scope.kind === "global") {
    return { kind: "global" };
  }

  if (scope.kind === "none") {
    throw new AppError("No site/plant is assigned to this account. Contact Ops Center.", 403);
  }

  if (scope.kind === "site") return { kind: "site", siteIds: scope.siteIds };
  const sites = await prisma.site.findMany({
    where: { organisationId: { in: scope.organisationIds } },
    select: { id: true }
  });
  return { kind: "site", siteIds: sites.map((site) => site.id) };
};

export const getOptionalSiteAccessScope = async (actor: AccessActor | undefined): Promise<SiteAccessScope> => {
  // Compatibility name only: request-facing access always requires an identity.
  return getSiteAccessScope(actor);
};

export const resolveScopedSiteId = async (
  actor: AccessActor | undefined,
  requestedSiteId: string | null | undefined
): Promise<string | Prisma.StringFilter | undefined> => {
  const scope = await getOptionalSiteAccessScope(actor);

  if (scope.kind === "global") {
    return requestedSiteId ?? undefined;
  }

  if (requestedSiteId && !scope.siteIds.includes(requestedSiteId)) {
    throw new AppError("You can only access data for your assigned site/plant.", 403);
  }

  return requestedSiteId ?? { in: scope.siteIds };
};

export const assertNodeSiteAccess = async (
  nodeId: string,
  actor: AccessActor | undefined
): Promise<void> => {
  const scope = await getOptionalSiteAccessScope(actor);
  if (scope.kind === "global") {
    return;
  }

  const node = await prisma.edgeNode.findUnique({
    where: { id: nodeId },
    select: { siteId: true }
  });

  if (!node) {
    throw new AppError("Node not found.", 404);
  }

  if (!node.siteId || !scope.siteIds.includes(node.siteId)) {
    throw new AppError("You can only access nodes for your assigned site/plant.", 403);
  }
};
