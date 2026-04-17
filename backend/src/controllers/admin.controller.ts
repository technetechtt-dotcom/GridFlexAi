import type { Request, Response } from "express";

import type {
  AdminNodeUpdateBody,
  ApiCredentialBody,
  ApiCredentialUpdateBody,
  ClientBody,
  ClientUpdateBody,
  SiteBody,
  SiteUpdateBody } from
"../schemas/request.schemas.js";
import {
  createApiCredential,
  createClient,
  createSite,
  deleteApiCredential,
  deleteClient,
  deleteSite,
  listApiCredentials,
  listClients,
  listManagedNodes,
  listSites,
  updateApiCredential,
  updateClient,
  updateManagedNode,
  updateSite } from
"../services/admin.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

type IdParam = { id: string };

export const getClients = asyncHandler(async (_req: Request, res: Response) => {
  const data = await listClients();
  res.status(200).json({ data });
});

export const postClient = asyncHandler(async (
  req: Request<Record<string, never>, unknown, ClientBody>,
  res: Response
) => {
  const data = await createClient(req.body);
  res.status(201).json({ data });
});

export const patchClient = asyncHandler(async (
  req: Request<IdParam, unknown, ClientUpdateBody>,
  res: Response
) => {
  const data = await updateClient(req.params.id, req.body);
  res.status(200).json({ data });
});

export const removeClient = asyncHandler(async (
  req: Request<IdParam>,
  res: Response
) => {
  await deleteClient(req.params.id);
  res.status(200).json({ message: "Client deleted." });
});

export const getSites = asyncHandler(async (_req: Request, res: Response) => {
  const data = await listSites();
  res.status(200).json({ data });
});

export const postSite = asyncHandler(async (
  req: Request<Record<string, never>, unknown, SiteBody>,
  res: Response
) => {
  const data = await createSite(req.body);
  res.status(201).json({ data });
});

export const patchSite = asyncHandler(async (
  req: Request<IdParam, unknown, SiteUpdateBody>,
  res: Response
) => {
  const data = await updateSite(req.params.id, req.body);
  res.status(200).json({ data });
});

export const removeSite = asyncHandler(async (
  req: Request<IdParam>,
  res: Response
) => {
  await deleteSite(req.params.id);
  res.status(200).json({ message: "Site deleted." });
});

export const getNodes = asyncHandler(async (_req: Request, res: Response) => {
  const data = await listManagedNodes();
  res.status(200).json({ data });
});

export const patchNode = asyncHandler(async (
  req: Request<IdParam, unknown, AdminNodeUpdateBody>,
  res: Response
) => {
  const data = await updateManagedNode(req.params.id, req.body);
  res.status(200).json({ data });
});

export const getApiCredentials = asyncHandler(async (_req: Request, res: Response) => {
  const data = await listApiCredentials();
  res.status(200).json({ data });
});

export const postApiCredential = asyncHandler(async (
  req: Request<Record<string, never>, unknown, ApiCredentialBody>,
  res: Response
) => {
  const data = await createApiCredential(req.body);
  res.status(201).json({ data });
});

export const patchApiCredential = asyncHandler(async (
  req: Request<IdParam, unknown, ApiCredentialUpdateBody>,
  res: Response
) => {
  const data = await updateApiCredential(req.params.id, req.body);
  res.status(200).json({ data });
});

export const removeApiCredential = asyncHandler(async (
  req: Request<IdParam>,
  res: Response
) => {
  await deleteApiCredential(req.params.id);
  res.status(200).json({ message: "API credential deleted." });
});
