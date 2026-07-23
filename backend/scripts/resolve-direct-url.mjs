/**
 * Resolve DIRECT_URL for Prisma migrate deploy.
 * Uses DIRECT_URL when set; otherwise derives a direct connection from DATABASE_URL.
 */
import { URL } from "node:url";

const direct = process.env.DIRECT_URL?.trim();
if (direct) {
  process.stdout.write(direct);
  process.exit(0);
}

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error("DATABASE_URL is required when DIRECT_URL is unset.");
  process.exit(1);
}

let resolved;
try {
  const url = new URL(databaseUrl);
  const host = url.hostname.toLowerCase();

  if (host.endsWith("-pooler.neon.tech") || (host.includes("-pooler.") && host.endsWith(".neon.tech"))) {
    url.hostname = url.hostname.replace("-pooler", "");
    resolved = url.toString();
  } else if (host.endsWith(".pooler.supabase.com") && url.port === "6543") {
    const projectRef = url.username.match(/^postgres\.(.+)$/)?.[1];
    if (!projectRef) {
      throw new Error("Supabase pooler URL must use a postgres.<project-ref> username.");
    }
    url.hostname = `db.${projectRef}.supabase.co`;
    url.port = "5432";
    resolved = url.toString();
  } else if (host.includes("-pooler.")) {
    // Generic Neon-style pooler hostname rewrite (exact host segment, not substring anywhere).
    url.hostname = url.hostname.replace("-pooler", "");
    resolved = url.toString();
  } else {
    resolved = databaseUrl;
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Failed to derive DIRECT_URL from DATABASE_URL: ${message}`);
  process.exit(1);
}

process.stdout.write(resolved);
