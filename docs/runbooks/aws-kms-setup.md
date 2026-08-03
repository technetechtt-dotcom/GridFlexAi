# AWS KMS setup (device secret vault)

GridFlex encrypts per-device HMAC secrets at rest with AWS KMS when
`DEVICE_SECRET_VAULT_PROVIDER=aws_kms`.

**Workstation status 2026-08-03 (late):** AWS CLI **installed** (`aws-cli/2.36.14`).
IAM credentials still missing (`aws sts get-caller-identity` → NoCredentials).
`node scripts/verify-kms-readiness.mjs` → **fail**, 4 blockers (provider, key id, region, credentials).
Issue **#45** remains **Open** until staging and production Render services set
`DEVICE_SECRET_VAULT_PROVIDER=aws_kms` + `AWS_KMS_KEY_ID`, complete a vault round-trip boot,
and record credential rotation fingerprints (never secret values).

Dry-run without secrets: `node scripts/verify-kms-readiness.mjs`  
Bootstrap CMK + IAM user (when credentials exist):

```bash
# After: aws configure   (or AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_REGION)
BOOTSTRAP_AWS_KMS_ALLOW=true CREATE_IAM_ACCESS_KEY=true npm run bootstrap:aws-kms
```

Writes non-secret evidence to `go-live-reports/aws-kms-bootstrap.json`.
If `CREATE_IAM_ACCESS_KEY=true`, one-time secret material is written to
`go-live-reports/aws-kms-bootstrap.access-key.json` (gitignored) — copy into Render
and **delete the file**.

After Render credentials exist: `ROUND_TRIP=true node scripts/verify-kms-readiness.mjs`

Local/restore vault rehearseals do **not** satisfy #45.

Operator order of unlock: `docs/runbooks/platform-unblock-checklist.md`.

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
