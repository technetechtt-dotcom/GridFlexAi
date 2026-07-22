import type { Prisma, Role, SimulationRunStatus } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import {
  assertOrganisationAccess,
  assertSiteAccess,
  resolveAccessScope,
  type AccessScope
} from "../middleware/permissions.js";
import { AppError } from "../utils/AppError.js";
import type { AccessActor } from "./access-scope.service.js";

export type CreateSimulationRunInput = {
  organisationId: string;
  siteId: string;
  targetNodeId: string;
};

export type ListSimulationRunsInput = {
  siteId?: string;
  status?: SimulationRunStatus;
};

const includeTarget = {
  targetNode: {
    select: {
      id: true,
      name: true,
      location: true,
      status: true,
      siteId: true
    }
  }
} satisfies Prisma.SimulationRunInclude;

const scopeWhere = (scope: AccessScope): Prisma.SimulationRunWhereInput => {
  if (scope.kind === "global") return {};
  if (scope.kind === "organisation") {
    return { organisationId: { in: scope.organisationIds } };
  }
  if (scope.kind === "site") {
    return { siteId: { in: scope.siteIds } };
  }
  return { id: "__none__" };
};

const actorScope = async (actor: AccessActor): Promise<AccessScope> =>
  resolveAccessScope(actor.id, actor.role as Role);

export const createSimulationRun = async (
  input: CreateSimulationRunInput,
  actor: AccessActor
) => {
  const scope = await actorScope(actor);
  assertOrganisationAccess(scope, input.organisationId);
  await assertSiteAccess(scope, input.siteId);

  const targetNode = await prisma.edgeNode.findUnique({
    where: { id: input.targetNodeId },
    select: {
      id: true,
      siteId: true,
      site: { select: { organisationId: true } }
    }
  });

  if (!targetNode) {
    throw new AppError("Simulation target node not found.", 404);
  }
  if (targetNode.siteId !== input.siteId) {
    throw new AppError("Simulation target node must belong to the selected site.", 400);
  }
  if (targetNode.site?.organisationId !== input.organisationId) {
    throw new AppError("Simulation organisation and site must be consistent.", 400);
  }

  return prisma.simulationRun.create({
    data: {
      organisationId: input.organisationId,
      siteId: input.siteId,
      targetNodeId: targetNode.id,
      createdById: actor.id
    },
    include: includeTarget
  });
};

export const listSimulationRuns = async (
  input: ListSimulationRunsInput,
  actor: AccessActor
) => {
  const scope = await actorScope(actor);
  if (input.siteId) {
    await assertSiteAccess(scope, input.siteId);
  }

  return prisma.simulationRun.findMany({
    where: {
      AND: [
        scopeWhere(scope),
        ...(input.siteId ? [{ siteId: input.siteId }] : []),
        ...(input.status ? [{ status: input.status }] : [])
      ]
    },
    include: includeTarget,
    orderBy: { createdAt: "desc" }
  });
};

export const getSimulationRun = async (runId: string, actor: AccessActor) => {
  const scope = await actorScope(actor);
  const run = await prisma.simulationRun.findFirst({
    where: {
      id: runId,
      ...scopeWhere(scope)
    },
    include: includeTarget
  });

  if (!run) {
    throw new AppError("Simulation run not found.", 404);
  }
  return run;
};

export const stopSimulationRun = async (runId: string, actor: AccessActor) => {
  const run = await getSimulationRun(runId, actor);
  if (run.status !== "running") {
    return run;
  }

  return prisma.simulationRun.update({
    where: { id: run.id },
    data: {
      status: "stopped",
      stoppedAt: new Date()
    },
    include: includeTarget
  });
};
