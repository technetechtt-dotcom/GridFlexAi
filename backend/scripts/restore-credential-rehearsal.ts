/**
 * Isolated restore-branch rehearsal: provision then rotate a vaulted device credential.
 *
 * Guard: RESTORE_CRED_REHEARSAL_ALLOW=true
 * Never writes plaintext secrets to the evidence file.
 *
 * Usage (against Neon restore branch DATABASE_URL + local vault for non-prod):
 *   RESTORE_CRED_REHEARSAL_ALLOW=true \
 *   DEVICE_SECRET_VAULT_PROVIDER=local \
 *   DEVICE_SECRET_VAULT_KEY=... \
 *   EDGE_NODE_ID=upington-solar-farm-node \
 *   npx tsx scripts/restore-credential-rehearsal.ts
 */
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { DeviceCredentialStatus, PrismaClient } from "@prisma/client";

import {
  completeCredentialRotation,
  provisionDeviceCredential
} from "../src/services/device-credential.service.js";

const allow = process.env.RESTORE_CRED_REHEARSAL_ALLOW === "true";
const edgeNodeId = process.env.EDGE_NODE_ID ?? "upington-solar-farm-node";
const outputFile =
  process.env.RESTORE_CRED_EVIDENCE_FILE ??
  path.join("..", "go-live-reports", "restore-credential-rehearsal.json");

if (!allow) {
  process.stderr.write("Refusing to run without RESTORE_CRED_REHEARSAL_ALLOW=true\n");
  process.exit(2);
}

const prisma = new PrismaClient();

const main = async () => {
  const actorEmail = process.env.RESTORE_CRED_ACTOR_EMAIL ?? "admin@gridflex.ai";
  const actor = await prisma.user.findUnique({ where: { email: actorEmail }, select: { id: true, email: true } });
  if (!actor) {
    throw new Error(`Actor user not found: ${actorEmail}`);
  }

  const node = await prisma.edgeNode.findUnique({ where: { id: edgeNodeId } });
  if (!node) {
    throw new Error(`Edge node not found: ${edgeNodeId}`);
  }

  const before = await prisma.deviceCredential.count({ where: { edgeNodeId } });

  let firstSummary: {
    credentialId: string;
    keyVersion: number;
    secretFingerprint: string | null;
    plaintextEmittedOnce: boolean;
  };

  if (before === 0) {
    const first = await provisionDeviceCredential({
      edgeNodeId,
      actorId: actor.id,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });
    firstSummary = {
      credentialId: first.credentialId,
      keyVersion: first.keyVersion,
      secretFingerprint: first.secretFingerprint,
      plaintextEmittedOnce: Boolean(first.secret)
    };
  } else {
    const existing = await prisma.deviceCredential.findFirst({
      where: { edgeNodeId, status: DeviceCredentialStatus.active },
      orderBy: { keyVersion: "desc" }
    });
    if (!existing) {
      throw new Error("Expected an active credential when beforeCount > 0");
    }
    firstSummary = {
      credentialId: existing.credentialId,
      keyVersion: existing.keyVersion,
      secretFingerprint: existing.secretFingerprint,
      plaintextEmittedOnce: false
    };
  }

  const rotated = await provisionDeviceCredential({
    edgeNodeId,
    actorId: actor.id,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  });

  const completion = await completeCredentialRotation({
    edgeNodeId,
    activeCredentialId: rotated.credentialId,
    actorId: actor.id
  });

  const statuses = await prisma.deviceCredential.findMany({
    where: { edgeNodeId },
    select: {
      credentialId: true,
      keyVersion: true,
      status: true,
      secretFingerprint: true,
      encryptionKeyId: true,
      rotatedAt: true,
      revokedAt: true
    },
    orderBy: { keyVersion: "asc" }
  });

  const active = statuses.filter((row) => row.status === DeviceCredentialStatus.active);
  const revoked = statuses.filter((row) => row.status === DeviceCredentialStatus.revoked);

  const report = {
    mode: "restore-credential-rehearsal",
    generatedAt: new Date().toISOString(),
    neonBranch: process.env.RESTORE_SMOKE_NEON_BRANCH ?? "restore-drill-20260722",
    edgeNodeId,
    actorEmail: actor.email,
    commitSha: process.env.GIT_COMMIT_SHA ?? null,
    beforeCount: before,
    afterCount: statuses.length,
    first: {
      ...firstSummary,
      plaintextRetainedInEvidence: false
    },
    rotated: {
      credentialId: rotated.credentialId,
      keyVersion: rotated.keyVersion,
      secretFingerprint: rotated.secretFingerprint,
      plaintextEmittedOnce: Boolean(rotated.secret),
      plaintextRetainedInEvidence: false
    },
    rotationComplete: completion,
    statuses,
    checks: {
      hasSingleActive: active.length === 1,
      previousRevoked: revoked.length >= 1,
      keyVersionIncremented: rotated.keyVersion === firstSummary.keyVersion + 1,
      activeIsRotated: active[0]?.credentialId === rotated.credentialId
    }
  };

  const failed = Object.values(report.checks).some((value) => value !== true);
  const absoluteOutput = path.resolve(process.cwd(), outputFile);
  await fs.mkdir(path.dirname(absoluteOutput), { recursive: true });
  const json = `${JSON.stringify(report, null, 2)}\n`;
  await fs.writeFile(absoluteOutput, json, "utf8");
  const sha256 = createHash("sha256").update(json).digest("hex");
  await fs.writeFile(`${absoluteOutput}.sha256`, `${sha256}  ${path.basename(absoluteOutput)}\n`, "utf8");

  process.stdout.write(
    `${JSON.stringify({
      ok: !failed,
      evidence: absoluteOutput,
      sha256,
      firstCredentialId: firstSummary.credentialId,
      rotatedCredentialId: rotated.credentialId,
      checks: report.checks
    })}\n`
  );

  if (failed) {
    process.exit(1);
  }
};

main()
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
