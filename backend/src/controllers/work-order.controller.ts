import type { Request, Response } from "express";

import { createWorkOrder, listWorkOrders, updateWorkOrder } from "../services/work-order.service.js";
import { AppError } from "../utils/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const actorFromReq = (req: Request) => {
  if (!req.user) throw new AppError("Authentication required.", 401);
  return { id: req.user.id, name: req.user.name, role: req.user.role };
};

export const getWorkOrdersHandler = asyncHandler(async (req: Request, res: Response) => {
  const limit = req.query.limit ? Number(req.query.limit) : 100;
  const data = await listWorkOrders(limit);
  res.status(200).json({ data });
});

export const postWorkOrderHandler = asyncHandler(async (req: Request, res: Response) => {
  const data = await createWorkOrder(req.body, actorFromReq(req));
  res.status(201).json({ data });
});

export const patchWorkOrderHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id;
  if (!id) throw new AppError("Work order id required.", 400);
  const data = await updateWorkOrder(id, req.body, actorFromReq(req));
  res.status(200).json({ data });
});
