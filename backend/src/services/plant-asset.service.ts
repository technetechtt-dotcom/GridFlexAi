import { AssetType, Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/AppError.js";
import { recordAuditLog } from "./audit-log.service.js";
import type { AccessActor } from "./access-scope.service.js";
import { getOptionalSiteAccessScope } from "./access-scope.service.js";

const wouldCreateCycle = async (assetId: string, parentAssetId: string): Promise<boolean> => {
  let current: string | null = parentAssetId;
  const visited = new Set<string>();
  while (current) {
    if (current === assetId) return true;
    if (visited.has(current)) return true;
    visited.add(current);
    const parent: { parentAssetId: string | null } | null = await prisma.asset.findUnique({
      where: { id: current },
      select: { parentAssetId: true }
    });
    current = parent?.parentAssetId ?? null;
  }
  return false;
};

export const listPlants = async (actor?: AccessActor) => {
  const scope = await getOptionalSiteAccessScope(actor);
  const where: Prisma.PlantWhereInput = {};
  if (scope.kind === "site") {
    where.siteId = scope.siteId;
  }
  return prisma.plant.findMany({
    where,
    orderBy: [{ name: "asc" }],
    include: {
      site: { select: { id: true, name: true, code: true } },
      _count: { select: { assets: true } }
    }
  });
};

export const createPlant = async (
  input: {
    organisationId: string;
    siteId: string;
    name: string;
    code: string;
    technology?: string;
    installedCapacityKw?: number;
    exportCapacityKw?: number;
    latitude?: number;
    longitude?: number;
  },
  actorId?: string
) => {
  const data: Prisma.PlantUncheckedCreateInput = {
    organisationId: input.organisationId,
    siteId: input.siteId,
    name: input.name,
    code: input.code,
    technology: input.technology ?? "solar_pv",
    installedCapacityKw: input.installedCapacityKw ?? 0,
    exportCapacityKw: input.exportCapacityKw ?? 0,
    status: "simulated",
    dataSourceType: "simulated"
  };
  if (typeof input.latitude === "number") data.latitude = input.latitude;
  if (typeof input.longitude === "number") data.longitude = input.longitude;

  const plant = await prisma.plant.create({ data });

  const audit: {
    action: string;
    entityType: string;
    entityId: string;
    message: string;
    userId?: string;
    organisationId: string;
    siteId: string;
  } = {
    action: "plant.create",
    entityType: "Plant",
    entityId: plant.id,
    message: `Created plant ${plant.code}`,
    organisationId: plant.organisationId,
    siteId: plant.siteId
  };
  if (actorId) audit.userId = actorId;
  await recordAuditLog(audit);

  return plant;
};

export const listAssets = async (plantId: string, actor?: AccessActor) => {
  const scope = await getOptionalSiteAccessScope(actor);
  const plant = await prisma.plant.findUnique({ where: { id: plantId } });
  if (!plant) throw new AppError("Plant not found.", 404);
  if (scope.kind === "site" && plant.siteId !== scope.siteId) {
    throw new AppError("Cross-tenant plant access denied.", 403);
  }

  return prisma.asset.findMany({
    where: { plantId },
    orderBy: [{ name: "asc" }],
    include: {
      state: true,
      edgeNode: { select: { id: true, name: true, serialNumber: true, healthState: true } },
      _count: { select: { childAssets: true, pointDefinitions: true } }
    }
  });
};

export const createAsset = async (
  input: {
    plantId: string;
    parentAssetId?: string;
    type: AssetType;
    name: string;
    serialNumber?: string;
    ratedPowerKw?: number;
    ratedEnergyKwh?: number;
    metadata?: unknown;
  },
  actorId?: string
) => {
  const plant = await prisma.plant.findUnique({ where: { id: input.plantId } });
  if (!plant) throw new AppError("Plant not found.", 404);

  if (input.parentAssetId) {
    const parent = await prisma.asset.findUnique({ where: { id: input.parentAssetId } });
    if (!parent || parent.plantId !== input.plantId) {
      throw new AppError("Parent asset must belong to the same plant.", 400);
    }
  }

  const data: Prisma.AssetUncheckedCreateInput = {
    plantId: input.plantId,
    type: input.type,
    name: input.name,
    status: "simulated",
    dataSourceType: "simulated",
    state: {
      create: {
        operatingState: "simulated",
        available: true
      }
    }
  };
  if (input.parentAssetId) data.parentAssetId = input.parentAssetId;
  if (input.serialNumber) data.serialNumber = input.serialNumber;
  if (typeof input.ratedPowerKw === "number") data.ratedPowerKw = input.ratedPowerKw;
  if (typeof input.ratedEnergyKwh === "number") data.ratedEnergyKwh = input.ratedEnergyKwh;
  if (input.metadata !== undefined) data.metadata = input.metadata as Prisma.InputJsonValue;

  const asset = await prisma.asset.create({ data });

  await recordAuditLog({
    action: "asset.create",
    entityType: "Asset",
    entityId: asset.id,
    message: `Created asset ${asset.name}`,
    userId: actorId,
    organisationId: plant.organisationId,
    siteId: plant.siteId
  });

  return asset;
};

export const updateAssetParent = async (
  assetId: string,
  parentAssetId: string | null,
  actorId?: string
) => {
  const asset = await prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset) throw new AppError("Asset not found.", 404);

  if (parentAssetId) {
    if (await wouldCreateCycle(assetId, parentAssetId)) {
      throw new AppError("Asset parent assignment would create a cycle.", 400);
    }
    const parent = await prisma.asset.findUnique({ where: { id: parentAssetId } });
    if (!parent || parent.plantId !== asset.plantId) {
      throw new AppError("Parent asset must belong to the same plant.", 400);
    }
  }

  const updated = await prisma.asset.update({
    where: { id: assetId },
    data: { parentAssetId }
  });

  await recordAuditLog({
    action: "asset.parent.update",
    entityType: "Asset",
    entityId: assetId,
    message: `Updated asset parent to ${parentAssetId ?? "none"}`,
    userId: actorId
  });

  return updated;
};

export const linkEdgeNodeToAsset = async (edgeNodeId: string, assetId: string, actorId?: string) => {
  const [node, asset] = await Promise.all([
    prisma.edgeNode.findUnique({ where: { id: edgeNodeId } }),
    prisma.asset.findUnique({ where: { id: assetId }, include: { plant: true } })
  ]);
  if (!node) throw new AppError("Edge node not found.", 404);
  if (!asset) throw new AppError("Asset not found.", 404);

  const updated = await prisma.edgeNode.update({
    where: { id: edgeNodeId },
    data: { assetId }
  });

  await recordAuditLog({
    action: "edgeNode.asset.link",
    entityType: "EdgeNode",
    entityId: edgeNodeId,
    message: `Linked edge node to asset ${asset.name}`,
    userId: actorId,
    organisationId: asset.plant.organisationId,
    siteId: asset.plant.siteId
  });

  return updated;
};
