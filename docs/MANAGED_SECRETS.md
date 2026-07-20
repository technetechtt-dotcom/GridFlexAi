# Managed secrets (Phase 7)

## Selected secret manager

**Production default:** hosting-provider secret store (Render Environment Groups / equivalent) **plus** AWS KMS for device-secret vault (`DEVICE_SECRET_VAULT_PROVIDER=aws_kms`).

| Provider | Use |
|----------|-----|
| Render / platform env secrets | App runtime secrets (`DATABASE_URL`, `JWT_*`, API keys, Redis) |
| AWS KMS | Per-device HMAC secret encryption at rest |
| Azure Key Vault / GCP KMS / HashiCorp Vault | Supported as vault provider targets; wire when that cloud is primary |

Local AES vault (`DEVICE_SECRET_VAULT_PROVIDER=local`) is **forbidden in production**.

## Eliminate secrets from files

Production secrets must **never** appear in:

- Git history / commits
- Committed `.env` files
- Docker images or `Dockerfile` `ENV` with real values
- Browser/`VITE_*` client bundles
- Application logs
- Runbooks with real credentials (placeholders only)

CI check: `npm run check:secrets-hygiene` (backend).

Root and backend `.gitignore` ignore `.env`, `.env.*` (except `*.example` / `*.keys` templates).

## Inventory

Authoritative table: [`docs/SECRETS_INVENTORY.md`](./SECRETS_INVENTORY.md) — owner, store, rotation period, last-rotation date.

## JWT rotation with `kid`

New tokens are signed with `JWT_ACTIVE_KID`. Overlapping secrets remain verifiable until sessions expire:

```bash
JWT_ACTIVE_KID=v2
JWT_SECRET=<v2-secret>   # also used if kid missing from JSON
JWT_SECRETS_JSON={"v1":"<old>","v2":"<new>"}
# or:
JWT_PREVIOUS_SECRET=<old>
JWT_PREVIOUS_KID=v1
```

After access+refresh TTLs pass for the old kid, remove `v1` from the map and revoke previous secret in the manager.

## Device credentials

Use vaulted GRIDFLEX-V1 provisioning + overlap rotation (`docs/DEVICE_PROVISIONING.md`). Do **not** ship device HMAC secrets via remote config.

## Rotation order

See [`docs/runbooks/secret-rotation.md`](./runbooks/secret-rotation.md).

## Acceptance

| Criterion | How we meet it |
|-----------|----------------|
| No production secret in Git | Hygiene check + gitignore + example placeholders only |
| Every secret has owner + last rotation | `SECRETS_INVENTORY.md` |
| Old credentials revoked | Runbook + rotation log |
| Device rotation without data loss | Sequence idempotency + credential overlap |
| Emergency rotation rehearsed | Runbook § Emergency + evidence row |
