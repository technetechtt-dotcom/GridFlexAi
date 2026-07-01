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
  location: z.string().min(2).max(160).optional(),
  status: z.enum(["online", "offline"]).optional(),
  siteId: z.string().nullable().optional()
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
export type ApiCredentialBody = z.infer<typeof apiCredentialBodySchema>;
export type ApiCredentialUpdateBody = z.infer<typeof apiCredentialUpdateBodySchema>;
export type AdminUserRoleUpdateBody = z.infer<typeof adminUserRoleUpdateBodySchema>;
export type BillingAccountBody = z.infer<typeof billingAccountBodySchema>;
export type BillingAccountUpdateBody = z.infer<typeof billingAccountUpdateBodySchema>;
export type InvoiceBody = z.infer<typeof invoiceBodySchema>;
export type InvoiceUpdateBody = z.infer<typeof invoiceUpdateBodySchema>;
