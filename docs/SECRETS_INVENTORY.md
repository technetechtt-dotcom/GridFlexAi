# Secrets inventory

Update **Last rotated** and **Owner** after every change. Do not put secret *values* in this file.

| Secret / identifier | Store | Owner | Rotation period | Last rotated | Notes |
|---------------------|-------|-------|-----------------|--------------|-------|
| `JWT_SECRET` / `JWT_SECRETS_JSON` | Platform secret manager | Platform eng | 90 days | _TBD_ | Overlap via `kid`; see MANAGED_SECRETS |
| `JWT_ACTIVE_KID` | Platform secret manager | Platform eng | with JWT | _TBD_ | Not secret; tracks active signing key |
| `DATABASE_URL` | Platform secret manager | Platform eng | 90 days (password) | _TBD_ | Rotate role password; update URL; revoke old |
| `REDIS_URL` | Platform secret manager | Platform eng | 90 days | _TBD_ | Rotate ACL password; flush not required |
| `DEVICE_SECRET_VAULT_PROVIDER` | Config | Platform eng | n/a | — | `aws_kms` in prod |
| `AWS_KMS_KEY_ID` | Platform secret manager | Platform eng | KMS policy | _TBD_ | Key id/ARN — rotate CMK per AWS policy |
| `DEVICE_SECRET_VAULT_KEY` | **Dev only** | Dev | n/a | — | Forbidden in production |
| `EDGE_INGEST_SHARED_SECRET` | Platform secret manager | Platform eng | Disable for pilot | _TBD_ | Legacy; set `EDGE_ALLOW_LEGACY_SHARED_SECRET=false` |
| Device HMAC credentials | KMS-encrypted DB rows | Edge ops | 90–180 days | _TBD_ | Per-device; overlap rotation |
| `EDGE_CONFIG_SIGNING_PRIVATE_KEY_PEM` | Platform secret manager | Platform eng | 180 days | _TBD_ | Ed25519; pin public on devices |
| `EDGE_CONFIG_SIGNING_PUBLIC_KEY_PEM` | Config / firmware pin | Edge ops | with private | _TBD_ | Not confidential alone |
| `OPENAI_API_KEY` | Platform secret manager | Platform eng | 90–180 days | _TBD_ | Revoke old key in provider console |
| `OPENWEATHER_API_KEY` | Platform secret manager | Platform eng | 90–180 days | _TBD_ | |
| `ACCUWEATHER_API_KEY` | Platform secret manager | Platform eng | 90–180 days | _TBD_ | |
| SMTP / webhook credentials | Platform secret manager | Platform eng | 90–180 days | _TBD_ | Add when email/webhooks enabled |
| Monitoring credentials | Platform secret manager | Platform eng | 90–180 days | _TBD_ | Add when APM/uptime keys provisioned |
| `HTTPS_PFX_PASSPHRASE` | Platform secret manager | Platform eng | with cert | _TBD_ | If PFX TLS used |
| Seed admin passwords | Local/dev only | Dev | n/a | — | Never production |

## Emergency rotation

Trigger immediately on suspected exposure. Record in `docs/runbooks/secret-rotation-log.md`.
