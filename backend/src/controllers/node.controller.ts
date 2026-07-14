import type { Request, Response } from "express";
import type { ParsedQs } from "qs";

import type {
  MaintenanceRequestBody,
  NodeBody,
  NodeBulkActionBody,
  NodeQuery,
  NodeUpdateBody
} from "../schemas/request.schemas.js";
import {
  bulkNodeAction,
  createEdgeNode,
  createNodeMaintenanceRequest,
  deleteEdgeNode,
  getNodeDetail,
  listNodesWithLastReading,
  updateEdgeNode
} from "../services/node.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

type IdParam = { id: string };

export const getNodes = asyncHandler(async (
  req: Request<Record<string, never>, unknown, unknown, ParsedQs>,
  res: Response
) => {
  const nodes = await listNodesWithLastReading(req.query as unknown as NodeQuery, req.user);
  res.status(200).json({ data: nodes });
});

export const getNode = asyncHandler(async (
  req: Request<IdParam>,
  res: Response
) => {
  const node = await getNodeDetail(req.params.id, req.user);
  res.status(200).json({ data: node });
});

export const postNode = asyncHandler(async (
  req: Request<Record<string, never>, unknown, NodeBody>,
  res: Response
) => {
  const node = await createEdgeNode(req.body, req.user?.id);
  res.status(201).json({ data: node });
});

export const patchNode = asyncHandler(async (
  req: Request<IdParam, unknown, NodeUpdateBody>,
  res: Response
) => {
  const node = await updateEdgeNode(req.params.id, req.body, req.user?.id);
  res.status(200).json({ data: node });
});

export const removeNode = asyncHandler(async (
  req: Request<IdParam>,
  res: Response
) => {
  await deleteEdgeNode(req.params.id, req.user?.id);
  res.status(200).json({ message: "Node deleted." });
});

export const postNodeBulkAction = asyncHandler(async (
  req: Request<Record<string, never>, unknown, NodeBulkActionBody>,
  res: Response
) => {
  const result = await bulkNodeAction(req.body, req.user?.id);
  res.status(200).json({ data: result });
});

export const postNodeMaintenanceRequest = asyncHandler(async (
  req: Request<IdParam, unknown, MaintenanceRequestBody>,
  res: Response
) => {
  const request = await createNodeMaintenanceRequest(req.params.id, req.body, req.user?.id, req.user);
  res.status(201).json({ data: request });
});
