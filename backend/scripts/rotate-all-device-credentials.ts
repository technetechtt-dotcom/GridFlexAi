/**
 * List legacy hash-only credentials and optionally rotate all active vaulted devices
 * by provisioning a new overlapping credential (prints one-shot secrets to stdout).
 *
 * Usage:
 *   npx tsx scripts/rotate-all-device-credentials.ts --dry-run
 *   ROTATE_DEVICES_ALLOW=true npx tsx scripts/rotate-all-device-credentials.ts --execute
 *
 * Never commit output. Flash each new secret into GridFlexEdge config.h / secure element.
 */

import { DeviceCredentialStatus, PrismaClient } from "@prisma/client";
import { provisionDeviceCredential } from "../src/services/device-credential.service.js";

const prisma = new PrismaClient();

const dryRun = process.argv.includes("--dry-run") || !process.argv.includes("--execute");
const allow = process.env.ROTATE_DEVICES_ALLOW === "true";

async function main() {
  if (!dryRun && !allow) {
    console.error("Refusing to execute without ROTATE_DEVICES_ALLOW=true");
    process.exit(1);
  }

  const legacy = await prisma.deviceCredential.findMany({
    where: {
      OR: [{ encryptedSecret: null }, { encryptionKeyId: null }],
      status: { in: [DeviceCredentialStatus.active, DeviceCredentialStatus.pending] }
    },
    select: {
      id: true,
      credentialId: true,
      edgeNodeId: true,
      status: true,
      secretHash: true,
      encryptedSecret: true
    }
  });

  console.log(JSON.stringify({ phase: "legacy_hash_only", count: legacy.length, dryRun }, null, 2));
  for (const row of legacy) {
    console.log(
      JSON.stringify({
        action: dryRun ? "would_revoke_and_reprovision" : "reprovision_required",
        credentialId: row.credentialId,
        edgeNodeId: row.edgeNodeId,
        hasSecretHash: Boolean(row.secretHash),
        hasVault: Boolean(row.encryptedSecret)
      })
    );
  }

  const activeVaulted = await prisma.deviceCredential.findMany({
    where: {
      status: DeviceCredentialStatus.active,
      encryptedSecret: { not: null },
      encryptionKeyId: { not: null }
    },
    select: { credentialId: true, edgeNodeId: true, keyVersion: true }
  });

  console.log(JSON.stringify({ phase: "active_vaulted", count: activeVaulted.length, dryRun }, null, 2));

  if (dryRun) {
    console.log("[rotate-all-device-credentials] dry-run complete — pass --execute with ROTATE_DEVICES_ALLOW=true");
    return;
  }

  for (const row of legacy) {
    await prisma.deviceCredential.update({
      where: { id: row.id },
      data: { status: DeviceCredentialStatus.revoked, revokedAt: new Date() }
    });
    const provisioned = await provisionDeviceCredential({
      edgeNodeId: row.edgeNodeId,
      actorId: "ops-rotate-script",
      expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000)
    });
    console.log(
      JSON.stringify({
        action: "reprovisioned_from_legacy",
        edgeNodeId: row.edgeNodeId,
        oldCredentialId: row.credentialId,
        newCredentialId: provisioned.credentialId,
        keyVersion: provisioned.keyVersion,
        oneShotSecret: provisioned.secret
      })
    );
  }

  for (const row of activeVaulted) {
    const provisioned = await provisionDeviceCredential({
      edgeNodeId: row.edgeNodeId,
      actorId: "ops-rotate-script",
      expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000)
    });
    console.log(
      JSON.stringify({
        action: "rotated_vaulted",
        edgeNodeId: row.edgeNodeId,
        previousCredentialId: row.credentialId,
        previousKeyVersion: row.keyVersion,
        newCredentialId: provisioned.credentialId,
        keyVersion: provisioned.keyVersion,
        oneShotSecret: provisioned.secret
      })
    );
  }

  console.log("[rotate-all-device-credentials] complete — update secret-rotation-log.md and flash devices");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
