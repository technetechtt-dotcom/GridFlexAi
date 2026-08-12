# AWS KMS setup (device secret vault)

GridFlex encrypts per-device HMAC secrets at rest with AWS KMS when
`DEVICE_SECRET_VAULT_PROVIDER=aws_kms`.

**Workstation status 2026-08-12:** AWS CLI installed. IAM credentials still
required before bootstrap can create a CMK. Local restore vault rehearseals do
**not** satisfy issue #45.

## Secure bootstrap (preferred)

The bootstrap script is fail-closed:

- requires `BOOTSTRAP_AWS_KMS_ALLOW=true`
- does **not** invoke a shell (no interpolation of alias / user / region)
- validates region, alias, and IAM user names
- writes reports only under `go-live-reports/`
- never prints `SecretAccessKey`
- long-lived IAM access keys need dual confirmation

Self-test (no AWS required):

```bash
npm run bootstrap:aws-kms:self-test
```

Dry-run after `aws configure`:

```bash
BOOTSTRAP_AWS_KMS_ALLOW=true DRY_RUN=true EXPECTED_AWS_ACCOUNT_ID=<12-digit> npm run bootstrap:aws-kms
```

Apply (CMK + IAM user + least-privilege inline policy; **no** access key):

```bash
BOOTSTRAP_AWS_KMS_ALLOW=true EXPECTED_AWS_ACCOUNT_ID=<12-digit> npm run bootstrap:aws-kms
```

Only if Render cannot use a role and must have static keys:

```bash
BOOTSTRAP_AWS_KMS_ALLOW=true \
CREATE_IAM_ACCESS_KEY=true \
CONFIRM_CREATE_ACCESS_KEY=I_UNDERSTAND_LONG_LIVED_KEYS \
EXPECTED_AWS_ACCOUNT_ID=<12-digit> \
npm run bootstrap:aws-kms
```

Copy the one-time file `go-live-reports/aws-kms-bootstrap.access-key.json` into
Render, then **delete the file**. Do not commit it (`go-live-reports/*` is gitignored).

After Render env is set:

```bash
ROUND_TRIP=true DEVICE_SECRET_VAULT_PROVIDER=aws_kms AWS_KMS_KEY_ID=<arn> npm run verify:kms-readiness
```

Require boot log `{"event":"device_secret_vault.round_trip_ok","provider":"aws_kms",...}`.

## Render environment

| Key | Value |
|-----|--------|
| `DEVICE_SECRET_VAULT_PROVIDER` | `aws_kms` |
| `AWS_KMS_KEY_ID` | Key id or full ARN |
| `AWS_REGION` | e.g. `eu-west-1` |
| `AWS_ACCESS_KEY_ID` | IAM access key (if not using instance role) |
| `AWS_SECRET_ACCESS_KEY` | IAM secret |

Remove `DEVICE_SECRET_VAULT_KEY` when using KMS.

## Encryption context

```json
{ "application": "gridflex", "purpose": "device-hmac-secret" }
```

## Rollback

Temporary emergency only: switch to `local` is **blocked in production** by design.
Keep a standby CMK / key policy and rotate credentials if the CMK is compromised.
