import { ApiProvider, NodeStatus, Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { recordAuditLog } from "./audit-log.service.js";
import type {
  AdminNodeUpdateBody,
  ApiCredentialBody,
  ApiCredentialUpdateBody,
  ClientBody,
  ClientUpdateBody,
  SiteBody,
  SiteUpdateBody } from
"../schemas/request.schemas.js";

const toApiProvider = (value: ApiCredentialBody["provider"]): ApiProvider => {
  switch (value) {
    case "openai":
      return ApiProvider.openai;
    case "openweather":
      return ApiProvider.openweather;
    case "accuweather":
      return ApiProvider.accuweather;
    default:
      return ApiProvider.custom;
  }
};

export const listClients = async () => {
  const clients = await prisma.client.findMany({
    orderBy: [{ createdAt: "desc" }],
    include: {
      _count: {
        select: {
          sites: true,
          credentials: true
        }
      }
    }
  });

  return clients.map((client) => ({
    id: client.id,
    name: client.name,
    slug: client.slug,
    contactEmail: client.contactEmail,
    status: client.status,
    createdAt: client.createdAt.toISOString(),
    siteCount: client._count.sites,
    credentialCount: client._count.credentials
  }));
};

export const createClient = async (input: ClientBody) => {
  const payload: Prisma.ClientCreateInput = {
    name: input.name,
    slug: input.slug,
    status: input.status
  };
  if (typeof input.contactEmail === "string") {
    payload.contactEmail = input.contactEmail;
  }

  const client = await prisma.client.create({
    data: payload
  });
  await recordAuditLog({
    action: "admin.client.create",
    entityType: "Client",
    entityId: client.id,
    message: `Created client ${client.name}`
  });
  return client;
};

export const updateClient = async (id: string, input: ClientUpdateBody) => {
  const payload: Prisma.ClientUpdateInput = {};
  if (typeof input.name === "string") payload.name = input.name;
  if (typeof input.slug === "string") payload.slug = input.slug;
  if (typeof input.status === "string") payload.status = input.status;
  if (typeof input.contactEmail === "string") payload.contactEmail = input.contactEmail;

  const client = await prisma.client.update({
    where: { id },
    data: payload
  });
  await recordAuditLog({
    action: "admin.client.update",
    entityType: "Client",
    entityId: client.id,
    message: `Updated client ${client.name}`
  });
  return client;
};

export const deleteClient = async (id: string) => {
  await prisma.client.delete({ where: { id } });
  await recordAuditLog({
    action: "admin.client.delete",
    entityType: "Client",
    entityId: id,
    message: "Deleted client"
  });
};

export const listSites = async () => {
  const sites = await prisma.site.findMany({
    orderBy: [{ createdAt: "desc" }],
    include: {
      client: {
        select: {
          id: true,
          name: true,
          slug: true
        }
      },
      _count: {
        select: {
          nodes: true,
          credentials: true
        }
      }
    }
  });

  return sites.map((site) => ({
    id: site.id,
    clientId: site.clientId,
    client: site.client,
    name: site.name,
    code: site.code,
    location: site.location,
    timezone: site.timezone,
    createdAt: site.createdAt.toISOString(),
    nodeCount: site._count.nodes,
    credentialCount: site._count.credentials
  }));
};

export const createSite = async (input: SiteBody) => {
  const payload: Prisma.SiteCreateInput = {
    name: input.name,
    code: input.code,
    location: input.location,
    timezone: input.timezone,
    client: {
      connect: {
        id: input.clientId
      }
    }
  };

  const site = await prisma.site.create({
    data: payload
  });
  await recordAuditLog({
    action: "admin.site.create",
    entityType: "Site",
    entityId: site.id,
    message: `Created site ${site.name}`
  });
  return site;
};

export const updateSite = async (id: string, input: SiteUpdateBody) => {
  const payload: Prisma.SiteUpdateInput = {};
  if (typeof input.name === "string") payload.name = input.name;
  if (typeof input.code === "string") payload.code = input.code;
  if (typeof input.location === "string") payload.location = input.location;
  if (typeof input.timezone === "string") payload.timezone = input.timezone;
  if (typeof input.clientId === "string") {
    payload.client = {
      connect: {
        id: input.clientId
      }
    };
  }

  const site = await prisma.site.update({
    where: { id },
    data: payload
  });
  await recordAuditLog({
    action: "admin.site.update",
    entityType: "Site",
    entityId: site.id,
    message: `Updated site ${site.name}`
  });
  return site;
};

export const deleteSite = async (id: string) => {
  await prisma.site.delete({
    where: { id }
  });
  await recordAuditLog({
    action: "admin.site.delete",
    entityType: "Site",
    entityId: id,
    message: "Deleted site"
  });
};

import { hashPassword } from "../utils/password.js";

export const listManagedNodes = async () => {
  const nodes = await prisma.edgeNode.findMany({
    orderBy: [{ createdAt: "desc" }],
    include: {
      site: {
        select: {
          id: true,
          name: true,
          code: true,
          client: {
            select: {
              id: true,
              name: true
            }
          }
        }
      }
    }
  });

  return nodes.map((node) => ({
    id: node.id,
    name: node.name,
    location: node.location,
    status: node.status,
    lastSeen: node.lastSeen?.toISOString() ?? null,
    siteId: node.siteId,
    site: node.site
  }));
};

export const updateManagedNode = async (id: string, input: AdminNodeUpdateBody) => {
  const payload: Prisma.EdgeNodeUpdateInput = {};
  if (typeof input.name === "string") payload.name = input.name;
  if (typeof input.location === "string") payload.location = input.location;
  if (typeof input.status === "string") payload.status = input.status === "online" ? NodeStatus.online : NodeStatus.offline;
  if (typeof input.isActive === "boolean") payload.isActive = input.isActive;
  if (input.siteId !== undefined) {
    payload.site = input.siteId ? { connect: { id: input.siteId } } : { disconnect: true };
  }

  const node = await prisma.edgeNode.update({
    where: { id },
    data: payload
  });
  await recordAuditLog({
    action: "admin.node.update",
    entityType: "EdgeNode",
    entityId: node.id,
    message: `Updated node ${node.name}`
  });
  return node;
};

export const resetUserPassword = async (id: string, newPassword: string) => {
  const hashedPassword = await hashPassword(newPassword);
  const user = await prisma.user.update({
    where: { id },
    data: { password: hashedPassword }
  });
  
  await recordAuditLog({
    action: "admin.user.passwordReset",
    entityType: "User",
    entityId: id,
    message: `Password reset by admin`
  });
  
  return user;
};

export const listApiCredentials = async () => {
  const rows = await prisma.apiCredential.findMany({
    orderBy: [{ createdAt: "desc" }],
    include: {
      client: {
        select: {
          id: true,
          name: true,
          slug: true
        }
      },
      site: {
        select: {
          id: true,
          name: true,
          code: true
        }
      }
    }
  });

  return rows.map((row) => ({
    id: row.id,
    provider: row.provider,
    name: row.name,
    keyLast4: row.keyLast4,
    isActive: row.isActive,
    notes: row.notes,
    clientId: row.clientId,
    siteId: row.siteId,
    client: row.client,
    site: row.site,
    createdAt: row.createdAt.toISOString()
  }));
};

export const createApiCredential = async (input: ApiCredentialBody) => {
  const keyLast4 = input.apiKey.slice(-4);
  const payload: Prisma.ApiCredentialCreateInput = {
    provider: toApiProvider(input.provider),
    name: input.name,
    keyLast4,
    isActive: input.isActive ?? true
  };

  if (typeof input.notes === "string") {
    payload.notes = input.notes;
  }
  if (typeof input.clientId === "string") {
    payload.client = {
      connect: {
        id: input.clientId
      }
    };
  }
  if (typeof input.siteId === "string") {
    payload.site = {
      connect: {
        id: input.siteId
      }
    };
  }

  const credential = await prisma.apiCredential.create({
    data: payload
  });
  await recordAuditLog({
    action: "admin.apiCredential.create",
    entityType: "ApiCredential",
    entityId: credential.id,
    message: `Created API credential ${credential.name}`
  });
  return credential;
};

export const updateApiCredential = async (id: string, input: ApiCredentialUpdateBody) => {
  const payload: Prisma.ApiCredentialUpdateInput = {};
  if (typeof input.name === "string") payload.name = input.name;
  if (typeof input.isActive === "boolean") payload.isActive = input.isActive;
  if (input.notes !== undefined) payload.notes = input.notes;
  if (input.clientId !== undefined) {
    payload.client = input.clientId ? { connect: { id: input.clientId } } : { disconnect: true };
  }
  if (input.siteId !== undefined) {
    payload.site = input.siteId ? { connect: { id: input.siteId } } : { disconnect: true };
  }

  const credential = await prisma.apiCredential.update({
    where: { id },
    data: payload
  });
  await recordAuditLog({
    action: "admin.apiCredential.update",
    entityType: "ApiCredential",
    entityId: credential.id,
    message: `Updated API credential ${credential.name}`
  });
  return credential;
};

export const deleteApiCredential = async (id: string) => {
  await prisma.apiCredential.delete({
    where: { id }
  });
  await recordAuditLog({
    action: "admin.apiCredential.delete",
    entityType: "ApiCredential",
    entityId: id,
    message: "Deleted API credential"
  });
};

export const listBillingAccounts = async () => {
  const accounts = await prisma.billingAccount.findMany({
    orderBy: [{ createdAt: "desc" }],
    include: {
      client: {
        select: {
          id: true,
          name: true,
          slug: true
        }
      },
      _count: {
        select: {
          invoices: true
        }
      }
    }
  });

  return accounts.map((acc) => ({
    id: acc.id,
    clientId: acc.clientId,
    client: acc.client,
    plan: acc.plan,
    status: acc.status,
    billingEmail: acc.billingEmail,
    taxId: acc.taxId,
    createdAt: acc.createdAt.toISOString(),
    invoiceCount: acc._count.invoices
  }));
};

export const createBillingAccount = async (input: { clientId: string; plan: string; status: string; billingEmail?: string | null | undefined; taxId?: string | null | undefined }) => {
  const payload: Prisma.BillingAccountCreateInput = {
    plan: input.plan,
    status: input.status,
    client: {
      connect: { id: input.clientId }
    }
  };
  
  if (typeof input.billingEmail === "string") {
    payload.billingEmail = input.billingEmail;
  }
  if (typeof input.taxId === "string") {
    payload.taxId = input.taxId;
  }

  const account = await prisma.billingAccount.create({
    data: payload
  });
  await recordAuditLog({
    action: "admin.billingAccount.create",
    entityType: "BillingAccount",
    entityId: account.id,
    message: `Created billing account for client ${input.clientId}`
  });
  return account;
};

export const updateBillingAccount = async (id: string, input: { plan?: string; status?: string; billingEmail?: string | null | undefined; taxId?: string | null | undefined }) => {
  const payload: Prisma.BillingAccountUpdateInput = {};
  if (typeof input.plan === "string") payload.plan = input.plan;
  if (typeof input.status === "string") payload.status = input.status;
  if (typeof input.billingEmail === "string") payload.billingEmail = input.billingEmail;
  if (typeof input.taxId === "string") payload.taxId = input.taxId;

  const account = await prisma.billingAccount.update({
    where: { id },
    data: payload
  });
  await recordAuditLog({
    action: "admin.billingAccount.update",
    entityType: "BillingAccount",
    entityId: account.id,
    message: `Updated billing account`
  });
  return account;
};

export const deleteBillingAccount = async (id: string) => {
  await prisma.billingAccount.delete({ where: { id } });
  await recordAuditLog({
    action: "admin.billingAccount.delete",
    entityType: "BillingAccount",
    entityId: id,
    message: "Deleted billing account"
  });
};
