#!/usr/bin/env node
/**
 * Prints a JWT overlapping-kid rotation snippet for paste into the secret manager.
 * Does not write secrets to disk. Never commit the output.
 *
 * Usage:
 *   node scripts/generate-jwt-rotation-snippet.mjs
 *   node scripts/generate-jwt-rotation-snippet.mjs --from-kid legacy --to-kid v2
 *   node scripts/generate-jwt-rotation-snippet.mjs --previous-secret "<current-jwt-secret>"
 *
 * If --previous-secret is omitted, only the NEW secret is generated; you must
 * paste your current JWT_SECRET into JWT_SECRETS_JSON yourself.
 */
import { randomBytes } from "node:crypto";

const args = process.argv.slice(2);
const get = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};

const fromKid = get("--from-kid") || "legacy";
const toKid = get("--to-kid") || `v${Date.now().toString().slice(-4)}`;
const previous = get("--previous-secret");
const newSecret = randomBytes(48).toString("base64url");

const map = previous
  ? { [fromKid]: previous, [toKid]: newSecret }
  : { [toKid]: newSecret };

console.log(`# JWT rotation snippet — paste into staging secret manager, then redeploy`);
console.log(`# Active kid: ${toKid}  |  Keep ${fromKid} until access+refresh TTLs expire`);
console.log(`# Generated: ${new Date().toISOString()}`);
console.log("");
console.log(`JWT_ACTIVE_KID=${toKid}`);
console.log(`JWT_SECRET=${newSecret}`);
if (previous) {
  console.log(`JWT_SECRETS_JSON=${JSON.stringify(map)}`);
  console.log(`JWT_PREVIOUS_SECRET=${previous}`);
  console.log(`JWT_PREVIOUS_KID=${fromKid}`);
} else {
  console.log(`# Set JWT_SECRETS_JSON to include BOTH kids, e.g.:`);
  console.log(`# JWT_SECRETS_JSON={"${fromKid}":"<CURRENT_JWT_SECRET>","${toKid}":"${newSecret}"}`);
  console.log(`JWT_PREVIOUS_KID=${fromKid}`);
  console.log(`# JWT_PREVIOUS_SECRET=<CURRENT_JWT_SECRET>`);
}
console.log("");
console.log("# After max(JWT_ACCESS_EXPIRES_IN, JWT_REFRESH_EXPIRES_IN) + margin:");
console.log(`# Remove kid "${fromKid}" from JWT_SECRETS_JSON and delete previous secret from the manager.`);
