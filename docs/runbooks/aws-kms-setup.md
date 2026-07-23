# AWS KMS setup (device secret vault)

GridFlex encrypts per-device HMAC secrets at rest with AWS KMS when
`DEVICE_SECRET_VAULT_PROVIDER=aws_kms`.

**Workstation status 2026-07-22:** AWS CLI not installed; no `AWS_ACCESS_KEY_ID` /
`AWS_PROFILE`. Cannot create CMK or verify Render vault round-trip from this machine
until IAM credentials and CLI are provisioned.

## 1. Create a CMK

```bash
aws kms create-key \
  --description "GridFlex device HMAC vault" \
  --key-usage ENCRYPT_DECRYPT \
  --origin AWS_KMS
```

Note the `KeyId` / ARN. Optionally alias it:

```bash
aws kms create-alias \
  --alias-name alias/gridflex-device-secrets \
  --target-key-id <KeyId>
```

## 2. IAM policy for Render (or the runtime role)

Allow at least:

- `kms:Encrypt`
- `kms:Decrypt`
- `kms:DescribeKey`

on that key ARN. Prefer a dedicated IAM user or role used only by GridFlex.

## 3. Render environment

| Key | Value |
|-----|--------|
| `DEVICE_SECRET_VAULT_PROVIDER` | `aws_kms` |
| `AWS_KMS_KEY_ID` | Key id or full ARN |
| `AWS_REGION` | e.g. `eu-west-1` |
| `AWS_ACCESS_KEY_ID` | IAM access key (if not using instance role) |
| `AWS_SECRET_ACCESS_KEY` | IAM secret |

Remove `DEVICE_SECRET_VAULT_KEY` when using KMS (not used by aws_kms path).

## 4. Redeploy and verify

1. Manual deploy the backend.
2. Startup runs an encrypt/decrypt round trip before opening the API port.
3. Require this log event:
   `{"event":"device_secret_vault.round_trip_ok","provider":"aws_kms",...}`.
4. Any encrypt/decrypt or IAM failure aborts startup; do not bypass it.
5. Provision a device credential from Ops/Admin only after the startup test passes.
6. If boot fails with `AWS_KMS_KEY_ID is required`, the env var is missing/empty on Render.

## Encryption context

Ciphertexts are bound to:

```json
{ "application": "gridflex", "purpose": "device-hmac-secret" }
```

Decrypt outside GridFlex must supply the same context.

## Rollback

Temporary emergency only: switch to `local` is **blocked in production** by design. Keep a standby CMK / key policy and rotate credentials if the CMK is compromised.
