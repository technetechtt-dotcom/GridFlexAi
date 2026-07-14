import { Role } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/AppError.js";

export type AccessActor = {
  id: string;
  role: string;
};

export type SiteAccessScope =
  | { kind: "global" }
  | { kind: "site"; siteId: string };

export const isGlobalAccessRole = (role: string | undefined): boolean =>
  role === Role.admin || role === Role.developer;

export const getSiteAccessScope = async (actor: AccessActor | undefined): Promise<SiteAccessScope> => {
  if (!actor) {
    throw new AppError("Authentication required.", 401);
  }

  if (isGlobalAccessRole(actor.role)) {
    return { kind: "global" };
  }

  const user = await prisma.user.findUnique({
    where: { id: actor.id },
    select: { siteId: true }
  });

  if (!user) {
    throw new AppError("User not found.", 401);
  }

  if (!user.siteId) {
    throw new AppError("No site/plant is assigned to this account. Contact Ops Center.", 403);
  }

  return {
    kind: "site",
    siteId: user.siteId
  };
};

export const getOptionalSiteAccessScope = async (actor: AccessActor | undefined): Promise<SiteAccessScope> => {
  if (!actor) {
    return { kind: "global" };
  }

  return getSiteAccessScope(actor);
};

export const resolveScopedSiteId = async (
  actor: AccessActor | undefined,
  requestedSiteId: string | null | undefined
): Promise<string | undefined> => {
  const scope = await getOptionalSiteAccessScope(actor);

  if (scope.kind === "global") {
    return requestedSiteId ?? undefined;
  }

  if (requestedSiteId && requestedSiteId !== scope.siteId) {
    throw new AppError("You can only access data for your assigned site/plant.", 403);
  }

  return scope.siteId;
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

  if (node.siteId !== scope.siteId) {
    throw new AppError("You can only access nodes for your assigned site/plant.", 403);
  }
};
