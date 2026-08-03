/**
 * Export privileged users / memberships / credential inventory for POPIA
 * access-review #1. Never prints passwords or device HMAC secrets.
 *
 *   EXPORT_ACCESS_REVIEW_ALLOW=true DATABASE_URL=... \
 *     npx tsx scripts/export-privileged-users.ts
 *
 * Writes fingerprint-safe JSON under ../go-live-reports/ (fixed path).
 */
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { DeviceCredentialStatus, PrismaClient } from "@prisma/client";

if (process.env.EXPORT_ACCESS_REVIEW_ALLOW !== "true") {
  process.stderr.write("Refusing to run without EXPORT_ACCESS_REVIEW_ALLOW=true\n");
  process.exit(2);
}

const prisma = new PrismaClient();
const outputFile = path.resolve(process.cwd(), "..", "go-live-reports", "access-review-privileged-export.json");

const PRIVILEGED_USER_ROLES = new Set(["admin", "manager", "developer"]);
const PRIVILEGED_MEMBERSHIP_ROLES = new Set([
  "portfolio_admin",
  "plant_manager",
  "super_admin",
  "developer"
]);

const main = async () => {
  const [users, orgMemberships, siteMemberships, deviceCredentials, apiCredentials] =
    await Promise.all([
      prisma.user.findMany({
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          lastLoginAt: true,
          createdAt: true
        },
        orderBy: { email: "asc" }
      }),
      prisma.organisationMembership.findMany({
        select: {
          id: true,
          role: true,
          status: true,
          userId: true,
          organisationId: true,
          user: { select: { email: true } },
          organisation: { select: { name: true } }
        }
      }),
      prisma.siteMembership.findMany({
        select: {
          id: true,
          role: true,
          status: true,
          userId: true,
          siteId: true,
          user: { select: { email: true } },
          site: { select: { name: true } }
        }
      }),
      prisma.deviceCredential.findMany({
        select: {
          id: true,
          edgeNodeId: true,
          status: true,
          keyVersion: true,
          expiresAt: true,
          revokedAt: true,
          createdAt: true
        }
      }),
      prisma.apiCredential.findMany({
        select: {
          id: true,
          name: true,
          provider: true,
          keyLast4: true,
          isActive: true,
          createdAt: true,
          clientId: true,
          siteId: true
        }
      })
    ]);

  const privilegedUsers = users.filter((u) => PRIVILEGED_USER_ROLES.has(u.role));
  const privilegedOrgMemberships = orgMemberships.filter((m) =>
    PRIVILEGED_MEMBERSHIP_ROLES.has(m.role)
  );
  const privilegedSiteMemberships = siteMemberships.filter((m) =>
    PRIVILEGED_MEMBERSHIP_ROLES.has(m.role)
  );
  const activeDeviceCredentials = deviceCredentials.filter(
    (c) => c.status === DeviceCredentialStatus.active
  );

  const report = {
    generatedAt: new Date().toISOString(),
    purpose: "POPIA access-review privileged inventory",
    note: "No passwords or HMAC secrets included.",
    counts: {
      usersTotal: users.length,
      privilegedUsers: privilegedUsers.length,
      privilegedOrgMemberships: privilegedOrgMemberships.length,
      privilegedSiteMemberships: privilegedSiteMemberships.length,
      deviceCredentialsActive: activeDeviceCredentials.length,
      deviceCredentialsTotal: deviceCredentials.length,
      apiCredentialsActive: apiCredentials.filter((c) => c.isActive).length,
      apiCredentialsTotal: apiCredentials.length
    },
    privilegedUsers: privilegedUsers.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      status: u.status,
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      createdAt: u.createdAt.toISOString()
    })),
    privilegedOrgMemberships: privilegedOrgMemberships.map((m) => ({
      id: m.id,
      email: m.user.email,
      organisationId: m.organisationId,
      organisationName: m.organisation.name,
      role: m.role,
      status: m.status
    })),
    privilegedSiteMemberships: privilegedSiteMemberships.map((m) => ({
      id: m.id,
      email: m.user.email,
      siteId: m.siteId,
      siteName: m.site.name,
      role: m.role,
      status: m.status
    })),
    deviceCredentials: deviceCredentials.map((c) => ({
      id: c.id,
      edgeNodeId: c.edgeNodeId,
      status: c.status,
      keyVersion: c.keyVersion,
      expiresAt: c.expiresAt?.toISOString() ?? null,
      revokedAt: c.revokedAt?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString()
    })),
    apiCredentials: apiCredentials.map((c) => ({
      id: c.id,
      name: c.name,
      provider: c.provider,
      keyLast4: c.keyLast4,
      isActive: c.isActive,
      clientId: c.clientId,
      siteId: c.siteId,
      createdAt: c.createdAt.toISOString()
    }))
  };

  await fs.mkdir(path.dirname(outputFile), { recursive: true });
  const json = `${JSON.stringify(report, null, 2)}\n`;
  await fs.writeFile(outputFile, json, "utf8");
  const sha256 = createHash("sha256").update(json).digest("hex");
  await fs.writeFile(`${outputFile}.sha256`, `${sha256}  ${path.basename(outputFile)}\n`, "utf8");

  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      evidence: outputFile,
      sha256,
      counts: report.counts
    })}\n`
  );
};

main()
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
