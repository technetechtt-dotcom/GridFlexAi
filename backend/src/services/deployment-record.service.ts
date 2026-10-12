import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

const latestMigrationVersion = async (): Promise<string | null> => {
  try {
    const rows = await prisma.$queryRaw<{ migration_name: string }[]>`
      SELECT migration_name FROM "_prisma_migrations"
      WHERE finished_at IS NOT NULL
      ORDER BY finished_at DESC
      LIMIT 1
    `;
    return rows[0]?.migration_name ?? null;
  } catch {
    return null;
  }
};

/** Record boot identity so operators can audit which release is running. */
export const recordDeploymentBoot = async (): Promise<void> => {
  try {
    const migrationVersion = await latestMigrationVersion();
    const gitSha = env.RELEASE_GIT_SHA?.trim() || null;
    const imageDigest = env.RELEASE_IMAGE_DIGEST?.trim() || null;
    const requireIdentity = env.REQUIRE_RELEASE_IDENTITY !== false;
    const cosignVerified = process.env.COSIGN_VERIFIED === "true" || process.env.COSIGN_VERIFIED === "1";

    await prisma.deploymentRecord.create({
      data: {
        environment: env.NODE_ENV,
        gitSha,
        imageDigest,
        migrationVersion,
        cosignVerified,
        requireIdentity,
        serviceName: process.env.RENDER_SERVICE_NAME || process.env.OTEL_SERVICE_NAME || "gridflex-api",
        notes: requireIdentity
          ? "Boot with release identity required"
          : "Boot with release identity optional (staging/source build)"
      }
    });
  } catch (error) {
    logger.warn("deployment.record_failed", {
      event: "deployment.record_failed",
      message: error instanceof Error ? error.message : "unknown"
    });
  }
};

export const listDeploymentRecords = async (limit = 50) => {
  const rows = await prisma.deploymentRecord.findMany({
    orderBy: { deployedAt: "desc" },
    take: Math.min(limit, 200)
  });
  return rows.map((row) => ({
    id: row.id,
    environment: row.environment,
    gitSha: row.gitSha,
    imageDigest: row.imageDigest,
    migrationVersion: row.migrationVersion,
    cosignVerified: row.cosignVerified,
    requireIdentity: row.requireIdentity,
    serviceName: row.serviceName,
    notes: row.notes,
    deployedAt: row.deployedAt.toISOString()
  }));
};
