/**
 * Post-restore integrity checks against an isolated DATABASE_URL.
 *
 * Guard: requires RESTORE_VERIFY_ALLOW=true so this cannot be run casually
 * against an ambiguous environment.
 *
 * Usage:
 *   RESTORE_VERIFY_ALLOW=true DATABASE_URL=... npx tsx scripts/restore-verify.ts
 */

import { PrismaClient } from "@prisma/client";

const allow = process.env.RESTORE_VERIFY_ALLOW === "true";
if (!allow) {
  process.stderr.write(
    "[restore:verify] Refusing to run without RESTORE_VERIFY_ALLOW=true (isolated restore only).\n"
  );
  process.exit(2);
}

if (!process.env.DATABASE_URL) {
  process.stderr.write("[restore:verify] DATABASE_URL is required.\n");
  process.exit(2);
}

const prisma = new PrismaClient();

const main = async () => {
  const started = Date.now();
  const [orgs, users, nodes, sensorReadings, telemetryReadings] = await Promise.all([
    prisma.organisation.count(),
    prisma.user.count(),
    prisma.edgeNode.count(),
    prisma.sensorReading.count(),
    prisma.telemetryReading.count()
  ]);

  const latestSensor = await prisma.sensorReading.findFirst({
    orderBy: { ingestedAt: "desc" },
    select: { ingestedAt: true, deviceTimestamp: true, nodeId: true }
  });

  const latestTelemetry = await prisma.telemetryReading.findFirst({
    orderBy: { ingestedAt: "desc" },
    select: { ingestedAt: true, deviceTimestamp: true, assetId: true, key: true }
  });

  const migrations = await prisma.$queryRawUnsafe<Array<{ migration_name: string; finished_at: Date | null }>>(
    `SELECT migration_name, finished_at FROM "_prisma_migrations" ORDER BY finished_at DESC NULLS LAST LIMIT 20`
  );

  const report = {
    ok: true,
    durationMs: Date.now() - started,
    counts: {
      organisations: orgs,
      users,
      edgeNodes: nodes,
      sensorReadings,
      telemetryReadings
    },
    latestSensor,
    latestTelemetry,
    recentMigrations: migrations,
    checks: {
      hasOrganisations: orgs > 0,
      hasUsers: users > 0,
      prismaMigrationsPresent: migrations.length > 0
    }
  };

  const failed =
    !report.checks.hasOrganisations ||
    !report.checks.hasUsers ||
    !report.checks.prismaMigrationsPresent;

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (failed) {
    process.stderr.write("[restore:verify] Integrity checks failed — see report.\n");
    process.exit(1);
  }
  process.stderr.write("[restore:verify] OK\n");
};

main()
  .catch((error) => {
    process.stderr.write(`[restore:verify] ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
