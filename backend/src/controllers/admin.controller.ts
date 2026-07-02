import type { Request, Response } from "express";

import type {
  AdminNodeUpdateBody,
  ApiCredentialBody,
  ApiCredentialUpdateBody,
  BillingAccountBody,
  BillingAccountUpdateBody,
  ClientBody,
  ClientUpdateBody,
  SiteBody,
  SiteUpdateBody,
  AdminUserPasswordResetBody } from
"../schemas/request.schemas.js";
import {
  createApiCredential,
  createBillingAccount,
  createClient,
  createSite,
  deleteApiCredential,
  deleteBillingAccount,
  deleteClient,
  deleteSite,
  listApiCredentials,
  listBillingAccounts,
  listClients,
  listManagedNodes,
  listSites,
  updateApiCredential,
  updateBillingAccount,
  updateClient,
  updateManagedNode,
  updateSite,
  resetUserPassword } from
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

export const getBillingAccounts = asyncHandler(async (_req: Request, res: Response) => {
  const data = await listBillingAccounts();
  res.status(200).json({ data });
});

export const postBillingAccount = asyncHandler(async (
  req: Request<Record<string, never>, unknown, BillingAccountBody>,
  res: Response
) => {
  const data = await createBillingAccount({
    clientId: req.body.clientId,
    plan: req.body.plan,
    status: req.body.status,
    billingEmail: req.body.billingEmail,
    taxId: req.body.taxId
  });
  res.status(201).json({ data });
});

export const patchBillingAccount = asyncHandler(async (
  req: Request<IdParam, unknown, BillingAccountUpdateBody>,
  res: Response
) => {
  const data = await updateBillingAccount(req.params.id, {
    plan: req.body.plan,
    status: req.body.status,
    billingEmail: req.body.billingEmail,
    taxId: req.body.taxId
  });
  res.status(200).json({ data });
});

export const removeBillingAccount = asyncHandler(async (
  req: Request<IdParam>,
  res: Response
) => {
  await deleteBillingAccount(req.params.id);
  res.status(200).json({ message: "Billing account deleted." });
});

export const patchUserPassword = asyncHandler(async (
  req: Request<IdParam, unknown, AdminUserPasswordResetBody>,
  res: Response
) => {
  await resetUserPassword(req.params.id, req.body.newPassword);
  res.status(200).json({ message: "User password reset successfully." });
});
