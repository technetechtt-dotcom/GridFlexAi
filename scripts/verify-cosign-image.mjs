#!/usr/bin/env node
/**
 * Verify a GHCR GridFlex backend image is Cosign-signed before production deploy.
 *
 * Usage:
 *   IMAGE_DIGEST=sha256:abc... npm run verify:cosign-image
 *   IMAGE=ghcr.io/org/repo@sha256:abc... npm run verify:cosign-image
 */
import { spawnSync } from "node:child_process";

const digest = (process.env.IMAGE_DIGEST || "").trim();
const image =
  (process.env.IMAGE || "").trim() ||
  (digest
    ? `ghcr.io/technetechtt-dotcom/gridflex-backend@${digest.startsWith("sha256:") ? digest : `sha256:${digest}`}`
    : "");

if (!image) {
  console.error("Set IMAGE or IMAGE_DIGEST.");
  process.exit(2);
}

const identity =
  process.env.COSIGN_CERTIFICATE_IDENTITY_REGEXP ||
  "https://github.com/technetechtt-dotcom/GridFlexAi/.github/workflows/.*";
const issuer =
  process.env.COSIGN_CERTIFICATE_OIDC_ISSUER || "https://token.actions.githubusercontent.com";

const cosign = spawnSync(
  "cosign",
  ["verify", `--certificate-identity-regexp=${identity}`, `--certificate-oidc-issuer=${issuer}`, image],
  { encoding: "utf8" }
);

if (cosign.error) {
  console.error("cosign not available:", cosign.error.message);
  console.error("Install: https://docs.sigstore.dev/cosign/system_config/installation/");
  process.exit(1);
}

process.stdout.write(cosign.stdout || "");
process.stderr.write(cosign.stderr || "");

if (cosign.status !== 0) {
  console.error(`Cosign verification FAILED for ${image}`);
  process.exit(cosign.status ?? 1);
}

console.log(`Cosign verification OK for ${image}`);
console.log("Safe to pin this digest on gridflex-backend-prod and set COSIGN_VERIFIED=true.");
