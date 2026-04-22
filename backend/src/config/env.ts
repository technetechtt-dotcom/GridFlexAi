import { config } from "dotenv";
import { z } from "zod";

config();

const envBoolean = z.preprocess((value) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) {
      return true;
    }
    if (["0", "false", "no", "off", ""].includes(normalized)) {
      return false;
    }
  }

  return value;
}, z.boolean());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  HTTPS_ENABLED: envBoolean.default(false),
  HTTPS_PORT: z.coerce.number().int().positive().default(4443),
  HTTPS_PFX_PATH: z.string().optional(),
  HTTPS_PFX_PASSPHRASE: z.string().optional(),
  HTTPS_CERT_PATH: z.string().optional(),
  HTTPS_KEY_PATH: z.string().optional(),
  FORCE_HTTPS: envBoolean.default(false),
  TRUST_PROXY: envBoolean.default(true),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("30d"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  ADMIN_ALLOWED_EMAILS: z.string().default("admin@gridflex.ai"),
  ADMIN_ALLOWED_IPS: z.string().default(""),
  ADMIN_REQUIRE_HTTPS: envBoolean.default(true),
  ADMIN_MAX_TOKEN_AGE_MINUTES: z.coerce.number().int().min(5).max(1440).default(30),
  EDGE_INGEST_SHARED_SECRET: z.string().min(16).default("dev-edge-secret-change-me"),
  EDGE_INGEST_MAX_SKEW_SECONDS: z.coerce.number().int().min(30).max(3600).default(300),
  EDGE_RATE_LIMIT_MAX_PER_MINUTE: z.coerce.number().int().min(5).max(1000).default(30),
  FORECAST_RATE_LIMIT_MAX_PER_MINUTE: z.coerce.number().int().min(5).max(1000).default(20),
  FORECAST_CRON_ENABLED: envBoolean.default(true),
  FORECAST_CRON_SCHEDULE: z.string().default("*/30 * * * *"),
  REDIS_URL: z.string().optional(),
  OPENWEATHER_API_KEY: z.string().optional(),
  ACCUWEATHER_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  FORECAST_CIRCUIT_FAILURE_THRESHOLD: z.coerce.number().int().min(1).default(3),
  FORECAST_CIRCUIT_OPEN_MS: z.coerce.number().int().min(1000).default(180000)
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
  process.stderr.write(`[env] Environment validation failed:\n${issues}\n`);
  const details = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(", ");
  throw new Error(`Invalid environment variables: ${details}`);
}

const validateProductionSafety = (config: z.infer<typeof envSchema>) => {
  if (config.NODE_ENV !== "production") {
    return;
  }

  const problems: string[] = [];
  const jwtSecret = config.JWT_SECRET.trim();
  const edgeSecret = config.EDGE_INGEST_SHARED_SECRET.trim();
  const forbiddenJwtSecrets = new Set([
    "change-this-in-production",
    "test-secret-with-minimum-length",
    "dev-secret-change-me"
  ]);
  const forbiddenEdgeSecrets = new Set([
    "change-this-edge-secret",
    "dev-edge-secret-change-me",
    "test-edge-secret-with-minimum-length"
  ]);

  if (jwtSecret.length < 32) {
    problems.push("JWT_SECRET must be at least 32 characters in production.");
  }
  if (forbiddenJwtSecrets.has(jwtSecret) || jwtSecret.toLowerCase().includes("change-this")) {
    problems.push("JWT_SECRET is using a known development placeholder.");
  }

  if (edgeSecret.length < 32) {
    problems.push("EDGE_INGEST_SHARED_SECRET must be at least 32 characters in production.");
  }
  if (forbiddenEdgeSecrets.has(edgeSecret) || edgeSecret.toLowerCase().includes("change-this")) {
    problems.push("EDGE_INGEST_SHARED_SECRET is using a known development placeholder.");
  }

  const corsOrigins = config.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean);
  const nonHttpsOrigins = corsOrigins.filter((origin) => origin.startsWith("http://"));
  const localOrigins = corsOrigins.filter((origin) => /localhost|127\.0\.0\.1/i.test(origin));
  if (nonHttpsOrigins.length > 0) {
    problems.push(`CORS_ORIGIN must use https in production. Invalid values: ${nonHttpsOrigins.join(", ")}`);
  }
  if (localOrigins.length > 0) {
    problems.push(`CORS_ORIGIN includes localhost entries in production: ${localOrigins.join(", ")}`);
  }

  if (!config.ADMIN_REQUIRE_HTTPS) {
    problems.push("ADMIN_REQUIRE_HTTPS must be true in production.");
  }

  if (problems.length > 0) {
    throw new Error(`Unsafe production environment configuration: ${problems.join(" ")}`);
  }
};

validateProductionSafety(parsed.data);

export const env = parsed.data;
