import { z } from "zod";

export const registerBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2)
});

export const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const readingsQuerySchema = z.object({
  nodeId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(100),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  windowHours: z.coerce.number().int().min(1).max(24 * 90).optional(),
  sort: z.enum(["asc", "desc"]).default("desc")
});

export const readingsSummaryQuerySchema = z.object({
  nodeId: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional()
});

export const edgeDataBodySchema = z.object({
  nodeId: z.string().optional(),
  voltage: z.coerce.number().finite(),
  current: z.coerce.number().finite(),
  power: z.coerce.number().finite(),
  energyToday: z.coerce.number().finite().optional(),
  inverterPower: z.coerce.number().finite().optional(),
  curtailment: z.coerce.number().finite().optional(),
  batteryLevel: z.coerce.number().min(0).max(100).optional(),
  signalStrength: z.coerce.number().finite().optional(),
  firmwareVersion: z.string().min(1).max(80).optional(),
  location: z.string().min(2).max(160).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  timestamp: z.string().datetime().optional()
});

export const forecastQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  capacity: z.coerce.number().positive().max(100000),
  tilt: z.coerce.number().min(0).max(90).optional(),
  azimuth: z.coerce.number().min(-180).max(180).optional()
});

export const dailyForecastPredictionsQuerySchema = z.object({
  nodeId: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(30)
});

export const aiChatBodySchema = z.object({
  message: z.string().min(1).max(4000).optional(),
  context: z.string().max(4000).optional(),
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant", "system"]).optional(),
      content: z.unknown().optional(),
      parts: z.array(z.unknown()).optional()
    }).passthrough()
  ).optional()
}).refine((value) => Boolean(value.message?.trim() || value.messages?.length), {
  message: "Either message or messages must be provided."
});

export const simulationNodeProfileSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(120),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  capacity: z.number().positive().max(100000)
});

export const simulationCongestionBodySchema = z.object({
  profiles: z.array(simulationNodeProfileSchema).min(1).max(20).optional()
});

export const clientBodySchema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().min(2).max(80).regex(/^[a-z0-9-]+$/),
  contactEmail: z.string().email().optional(),
  status: z.enum(["active", "inactive"]).default("active")
});

export const clientUpdateBodySchema = clientBodySchema.partial();

export const siteBodySchema = z.object({
  clientId: z.string().min(1),
  name: z.string().min(2).max(120),
  code: z.string().min(2).max(80).regex(/^[A-Za-z0-9_-]+$/),
  location: z.string().min(2).max(160),
  timezone: z.string().min(2).max(80).default("UTC")
});

export const siteUpdateBodySchema = siteBodySchema.partial();

export const adminNodeUpdateBodySchema = z.object({
  name: z.string().min(2).max(120).optional(),
  serialNumber: z.string().min(2).max(120).optional(),
  location: z.string().min(2).max(160).optional(),
  latitude: z.coerce.number().min(-90).max(90).nullable().optional(),
  longitude: z.coerce.number().min(-180).max(180).nullable().optional(),
  status: z.enum(["online", "offline", "maintenance"]).optional(),
  firmwareVersion: z.string().min(1).max(80).nullable().optional(),
  batteryLevel: z.coerce.number().min(0).max(100).nullable().optional(),
  signalStrength: z.coerce.number().finite().nullable().optional(),
  isActive: z.boolean().optional(),
  siteId: z.string().nullable().optional()
});

export const nodeQuerySchema = z.object({
  siteId: z.string().optional(),
  status: z.enum(["online", "offline", "maintenance"]).optional(),
  serialNumber: z.string().optional(),
  search: z.string().optional()
});

export const nodeBodySchema = z.object({
  name: z.string().min(2).max(120),
  serialNumber: z.string().min(2).max(120),
  siteId: z.string().nullable().optional(),
  location: z.string().min(2).max(160),
  latitude: z.coerce.number().min(-90).max(90).nullable().optional(),
  longitude: z.coerce.number().min(-180).max(180).nullable().optional(),
  status: z.enum(["online", "offline", "maintenance"]).default("offline"),
  firmwareVersion: z.string().min(1).max(80).nullable().optional(),
  batteryLevel: z.coerce.number().min(0).max(100).nullable().optional(),
  signalStrength: z.coerce.number().finite().nullable().optional(),
  installedAt: z.string().datetime().optional(),
  deviceKey: z.string().min(2).max(160).nullable().optional(),
  isActive: z.boolean().optional()
});

export const nodeUpdateBodySchema = nodeBodySchema.partial();

export const nodeBulkActionBodySchema = z.object({
  nodeIds: z.array(z.string().min(1)).min(1).max(250),
  action: z.enum(["assignSite", "updateStatus", "remoteRestart"]),
  siteId: z.string().nullable().optional(),
  status: z.enum(["online", "offline", "maintenance"]).optional()
}).superRefine((value, ctx) => {
  if (value.action === "assignSite" && value.siteId === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["siteId"],
      message: "siteId is required for assignSite."
    });
  }
  if (value.action === "updateStatus" && !value.status) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["status"],
      message: "status is required for updateStatus."
    });
  }
});

export const maintenanceRequestBodySchema = z.object({
  issueType: z.string().min(2).max(80),
  description: z.string().min(5).max(1000)
});

export const apiCredentialBodySchema = z.object({
  provider: z.enum(["openai", "openweather", "accuweather", "custom"]),
  name: z.string().min(2).max(120),
  apiKey: z.string().min(6),
  clientId: z.string().optional(),
  siteId: z.string().optional(),
  notes: z.string().max(500).optional(),
  isActive: z.boolean().optional()
});

export const apiCredentialUpdateBodySchema = z.object({
  name: z.string().min(2).max(120).optional(),
  notes: z.string().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
  clientId: z.string().nullable().optional(),
  siteId: z.string().nullable().optional()
});

export const adminUserRoleUpdateBodySchema = z.object({
  role: z.enum(["operator", "manager", "admin", "developer"])
});

export const adminUserPasswordResetBodySchema = z.object({
  newPassword: z.string().min(8)
});

export const managerOperatorProvisioningBodySchema = z.object({
  enabled: z.boolean(),
  maxOperators: z.coerce.number().int().min(2).max(50).optional()
});

export const createManagedOperatorBodySchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(128)
});

export const recordActivityBodySchema = z.object({
  action: z.string().min(1).max(120),
  message: z.string().max(500).optional(),
  entityType: z.string().max(80).optional(),
  entityId: z.string().max(120).optional(),
  metadata: z.unknown().optional()
});

export const billingAccountBodySchema = z.object({
  clientId: z.string().min(1),
  plan: z.enum(["starter", "pro", "enterprise"]).default("starter"),
  status: z.enum(["active", "suspended", "past_due"]).default("active"),
  billingEmail: z.string().email().optional(),
  taxId: z.string().optional()
});

export const billingAccountUpdateBodySchema = billingAccountBodySchema.partial();

export const invoiceBodySchema = z.object({
  billingAccountId: z.string().min(1),
  amountDue: z.coerce.number().min(0),
  currency: z.string().default("USD"),
  status: z.enum(["draft", "open", "paid", "void", "uncollectible"]).default("draft"),
  dueDate: z.string().datetime().optional()
});

export const invoiceUpdateBodySchema = invoiceBodySchema.partial().extend({
  paidAt: z.string().datetime().nullable().optional()
});

export const emptyBodySchema = z.object({}).strict();

export type RegisterBody = z.infer<typeof registerBodySchema>;
export type LoginBody = z.infer<typeof loginBodySchema>;
export type ReadingsQuery = z.infer<typeof readingsQuerySchema>;
export type ReadingsSummaryQuery = z.infer<typeof readingsSummaryQuerySchema>;
export type EdgeDataBody = z.infer<typeof edgeDataBodySchema>;
export type ForecastQuery = z.infer<typeof forecastQuerySchema>;
export type DailyForecastPredictionsQuery = z.infer<typeof dailyForecastPredictionsQuerySchema>;
export type AiChatBody = z.infer<typeof aiChatBodySchema>;
export type SimulationCongestionBody = z.infer<typeof simulationCongestionBodySchema>;
export type ClientBody = z.infer<typeof clientBodySchema>;
export type ClientUpdateBody = z.infer<typeof clientUpdateBodySchema>;
export type SiteBody = z.infer<typeof siteBodySchema>;
export type SiteUpdateBody = z.infer<typeof siteUpdateBodySchema>;
export type AdminNodeUpdateBody = z.infer<typeof adminNodeUpdateBodySchema>;
export type NodeQuery = z.infer<typeof nodeQuerySchema>;
export type NodeBody = z.infer<typeof nodeBodySchema>;
export type NodeUpdateBody = z.infer<typeof nodeUpdateBodySchema>;
export type NodeBulkActionBody = z.infer<typeof nodeBulkActionBodySchema>;
export type MaintenanceRequestBody = z.infer<typeof maintenanceRequestBodySchema>;
export type ApiCredentialBody = z.infer<typeof apiCredentialBodySchema>;
export type ApiCredentialUpdateBody = z.infer<typeof apiCredentialUpdateBodySchema>;
export type AdminUserRoleUpdateBody = z.infer<typeof adminUserRoleUpdateBodySchema>;
export type AdminUserPasswordResetBody = z.infer<typeof adminUserPasswordResetBodySchema>;
export type ManagerOperatorProvisioningBody = z.infer<typeof managerOperatorProvisioningBodySchema>;
export type CreateManagedOperatorBody = z.infer<typeof createManagedOperatorBodySchema>;
export type RecordActivityBody = z.infer<typeof recordActivityBodySchema>;
export type BillingAccountBody = z.infer<typeof billingAccountBodySchema>;
export type BillingAccountUpdateBody = z.infer<typeof billingAccountUpdateBodySchema>;
export type InvoiceBody = z.infer<typeof invoiceBodySchema>;
export type InvoiceUpdateBody = z.infer<typeof invoiceUpdateBodySchema>;
