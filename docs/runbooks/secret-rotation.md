# Runbook: Secret rotation (Phase 7)

## Scope

All items in [`docs/SECRETS_INVENTORY.md`](../SECRETS_INVENTORY.md). Prefer the **hosting secret manager** + **AWS KMS** for device vault material.

## Preconditions

- Staging environment available for verification before production.
- Rotation log entry prepared in [`secret-rotation-log.md`](./secret-rotation-log.md).
- On-call aware; rollback secret versions identified.

## Ordered procedure

### 1. Database credentials

1. Create a **new** DB role/password (Neon Console → Roles, or provider UI).
2. Update `DATABASE_URL` in **staging** secret manager → redeploy → smoke login + read APIs.
3. Update production `DATABASE_URL` → redeploy → verify.
4. **Revoke** the old database password/role.
5. Log success/failure.

### 2. Redis credentials

1. Create new ACL password / connection string.
2. Update `REDIS_URL` staging → production.
3. Confirm Socket.IO adapter + edge nonce store healthy.
4. Revoke old Redis password.

### 3. Weather and AI keys

1. Issue new keys in OpenWeather / AccuWeather / OpenAI consoles.
2. Update env in staging → production.
3. Hit forecast + AI smoke endpoints.
4. Revoke old provider keys.

### 4. JWT signing material (overlapping `kid`)

1. Generate new high-entropy secret (≥32 chars).
2. Set:
   - `JWT_ACTIVE_KID=vN+1`
   - `JWT_SECRETS_JSON` containing **both** old and new kids  
     (or `JWT_PREVIOUS_SECRET` + `JWT_PREVIOUS_KID`)
   - `JWT_SECRET` = new secret (legacy fallback / active if mapped)
3. Deploy. **Existing sessions remain valid** until access/refresh TTL under the old kid.
4. After max(`JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`) + margin, remove old kid from the map and delete the old secret from the manager.
5. Smoke: login, refresh, authenticated API.

### 5. Disable legacy edge shared secret

1. Confirm all pilot devices use vaulted GRIDFLEX-V1 credentials.
2. Set `EDGE_ALLOW_LEGACY_SHARED_SECRET=false`.
3. Remove or rotate `EDGE_INGEST_SHARED_SECRET` (unused).
4. Verify legacy HMAC clients receive 401.

### 6. Re-provision device credentials

1. For each edge node: provision new credential (`docs/DEVICE_PROVISIONING.md`).
2. Flash/config device with new secret (one-shot display).
3. Confirm ingest with new `credentialId` / `keyVersion`.
4. Complete overlap rotation; revoke prior credential.
5. Confirm queue/idempotent sequence continues without data loss.

### 7. Edge config signing key (if due)

1. Generate new Ed25519 pair; store private PEM in secret manager.
2. Distribute **public** key to devices via controlled firmware/config update (not HMAC channel).
3. Publish new signed remote config; revoke old private key after devices updated.

### 8. Audit

Record every attempt (success and failure) in the rotation log. Update **Last rotated** in the inventory.

## Emergency rotation

On suspected exposure:

1. Rotate the exposed secret **immediately** (JWT: add new kid, drop compromised kid ASAP — may force re-login).
2. Rotate dependent secrets if the same material was reused.
3. Re-provision affected devices.
4. Review access logs / failed auth.
5. Complete emergency row in the rotation log within 24h.

## Validation checklist

- [ ] Auth login / refresh / logout
- [ ] Edge V1 ingest (and legacy rejected if disabled)
- [ ] Forecast / AI providers
- [ ] Redis-backed features
- [ ] No secret values in Git diff / logs / runbooks

## Rollback

Revert secret manager version → redeploy → confirm. For JWT, keep previous kid in the keyring until sessions drain.
