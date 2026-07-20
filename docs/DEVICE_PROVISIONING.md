# Device Provisioning (vaulted secrets)

## Goals

- Per-device 256-bit secrets (never a global shared HMAC key in production)
- Envelope encryption via a managed KMS in production
- Ciphertext + fingerprint only in PostgreSQL
- GRIDFLEX-V1 HMAC-SHA256 request signing over the **raw** request body
- Key versioning with overlapping rotation (`active` / `rotating` / `revoked` / `expired`)

## Provisioning flow

1. Admin/developer calls `POST /api/admin/nodes/:edgeNodeId/credentials`.
2. API generates `randomBytes(32)`, encrypts via `DeviceSecretVault`, stores ciphertext + fingerprint.
3. Response returns `{ credentialId, keyVersion, secret, secretFingerprint, signingVersion }` **once**.
4. Device stores the Base64URL secret offline; server never stores plaintext.
5. Device signs each request with GRIDFLEX-V1 (see `backend/examples/edge_hmac_test_vector.md`).

### Headers

- `x-gridflex-device-id`
- `x-gridflex-credential-id`
- `x-gridflex-key-version`
- `x-gridflex-timestamp`
- `x-gridflex-nonce`
- `x-gridflex-sequence-number` (monotone increasing per credential)
- `x-gridflex-signature` (HMAC-SHA256 base64url)

## Vault providers

| `DEVICE_SECRET_VAULT_PROVIDER` | Use |
|--------------------------------|-----|
| `local` | Dev/test AES-256-GCM only — **forbidden in production** |
| `aws_kms` | AWS KMS (`AWS_KMS_KEY_ID` + `@aws-sdk/client-kms`) |
| `azure_key_vault` / `gcp_kms` | Reserved (fail closed until implemented) |

## Rotation

1. Provision key version `N+1` → previous `active` becomes `rotating`.
2. Deliver new secret through an authenticated provisioning channel.
3. First successful ingest with `N+1` revokes overlapping `rotating` credentials.
4. Audit log records `device.credential.rotation.complete`.

## Migration

Existing `secretHash`-only credentials **cannot** be converted. Re-provision every device. Auth rejects legacy hash-only rows with a re-provision message.

## Legacy mode

`EDGE_ALLOW_LEGACY_SHARED_SECRET=true` keeps the old hex HMAC over canonical JSON for ESP32 shared-secret demos. Production validation requires this flag to be `false`.

## Security properties

- Database contents alone cannot forge device messages (ciphertext without KMS/vault key).
- Replayed nonces and regressed sequence numbers are rejected.
- Secrets and signatures are not written to API lists or success audit metadata beyond fingerprints.
