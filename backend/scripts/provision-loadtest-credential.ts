/**
 * Provision one restore-branch load-test device credential and print one-shot
 * secret to stdout (never write plaintext to evidence files).
 *
 *   LOADTEST_CRED_ALLOW=true \
 *   DEVICE_SECRET_VAULT_PROVIDER=local \
 *   DEVICE_SECRET_VAULT_KEY=... \
 *   DATABASE_URL=... \
 *   npx tsx scripts/provision-loadtest-credential.ts
 */
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { DeviceCredentialStatus, PrismaClient } from "@prisma/client";

import { provisionDeviceCredential } from "../src/services/device-credential.service.js";

if (process.env.LOADTEST_CRED_ALLOW !== "true") {
  process.stderr.write("Refusing to run without LOADTEST_CRED_ALLOW=true\n");
  process.exit(2);
}

const prisma = new PrismaClient();
const edgeNodeId = process.env.EDGE_NODE_ID ?? "upington-solar-farm-node";
const actorEmail = process.env.LOADTEST_ACTOR_EMAIL ?? "admin@gridflex.ai";
const evidenceFile =
  process.env.LOADTEST_CRED_EVIDENCE_FILE ??
  path.join("..", "go-live-reports", "loadtest-credential-provision.json");

const main = async () => {
  const actor = await prisma.user.findUnique({
    where: { email: actorEmail },
    select: { id: true, email: true }
  });
  if (!actor) throw new Error(`Actor not found: ${actorEmail}`);

  const node = await prisma.edgeNode.findUnique({ where: { id: edgeNodeId } });
  if (!node) throw new Error(`Edge node not found: ${edgeNodeId}`);

  const provisioned = await provisionDeviceCredential({
    edgeNodeId,
    actorId: actor.id,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  });

  if (!provisioned.secret) {
    throw new Error("Provisioned credential did not emit a one-shot secret");
  }

  // Machine-readable for the caller (stdout). Evidence file is fingerprint-only.
  process.stdout.write(
    `${JSON.stringify({
      deviceId: edgeNodeId,
      credentialId: provisioned.credentialId,
      keyVersion: provisioned.keyVersion,
      secretB64Url: provisioned.secret
    })}\n`
  );

  const evidence = {
    mode: "loadtest-credential-provision",
    generatedAt: new Date().toISOString(),
    neonBranch: process.env.RESTORE_SMOKE_NEON_BRANCH ?? "restore-drill-20260722",
    edgeNodeId,
    credentialId: provisioned.credentialId,
    keyVersion: provisioned.keyVersion,
    secretFingerprint: provisioned.secretFingerprint,
    status: DeviceCredentialStatus.active,
    note: "Plaintext secret emitted once on stdout only; not stored in this file."
  };
  const body = `${JSON.stringify(evidence, null, 2)}\n`;
  await fs.mkdir(path.dirname(evidenceFile), { recursive: true });
  await fs.writeFile(evidenceFile, body, "utf8");
  const sha = createHash("sha256").update(body).digest("hex");
  await fs.writeFile(`${evidenceFile}.sha256`, `${sha}  ${path.basename(evidenceFile)}\n`, "utf8");
  process.stderr.write(`Evidence ${evidenceFile} sha256=${sha}\n`);
};

main()
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
