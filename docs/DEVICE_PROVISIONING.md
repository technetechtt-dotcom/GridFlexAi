# Device Provisioning

## Goals

Replace the global `EDGE_INGEST_SHARED_SECRET` with per-device credentials.

## Provisioning flow

1. Admin/developer calls `POST /api/admin/nodes/:edgeNodeId/credentials`.
2. API returns `{ credentialId, keyVersion, secret }` **once**.
3. Server stores only `SHA-256(secret)` as `secretHash`.
4. Device signs requests with HMAC using `secretHash` as key material (documented transitional scheme).
5. Headers:
   - `x-gridflex-device-id`
   - `x-gridflex-timestamp`
   - `x-gridflex-nonce`
   - `x-gridflex-signature`
   - `x-gridflex-credential-id`
   - `x-gridflex-key-version`

## Rotation

Provisioning a new credential marks the previous active credential as `rotating` for overlap, then activates the new key version.

## Revocation

`POST /api/admin/credentials/:credentialId/revoke` immediately rejects future signatures.

## Legacy mode

`EDGE_ALLOW_LEGACY_SHARED_SECRET=true` keeps ESP32 shared-secret compatibility. Production validation requires this flag to be `false`.
