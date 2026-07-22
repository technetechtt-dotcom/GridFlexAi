# Credential rotation & revocation rehearsal log

Record **evidence without secret values**. Status remains Open until rows are filled after a real staging/production rehearsal.

## Preconditions

- [ ] `EDGE_ALLOW_LEGACY_SHARED_SECRET=false` on target environment
- [ ] `DEVICE_SECRET_VAULT_PROVIDER=aws_kms` (+ key id)
- [ ] Redis available for replay nonces
- [ ] Physical execution flags remain **false** / pilot lock **true**

## Rotation run

Dry-run against isolated Neon restore branch `restore-drill-20260722` on 2026-07-22:
`npx tsx scripts/rotate-all-device-credentials.ts --dry-run` → `legacy_hash_only: 0`, `active_vaulted: 0`
(primary also has **0** `DeviceCredential` rows — provision devices before an execute rehearsal).

For every credential record only provider-safe identifiers such as key ID,
version, ARN, role name or last four characters. Never record a secret value.

| Credential class | Old key ID / version | New key ID / version | Issued UTC | Revoked UTC | Env | Operator | Evidence URL / SHA-256 | Pass? |
|------------------|----------------------|----------------------|------------|-------------|-----|----------|-----------------------|-------|
| Per-device secrets | | | | | | | | |
| JWT signing keys | | | | | | | | |
| Database role/password | | | | | | | | |
| Redis credentials | | | | | | | | |
| Ed25519 remote-config key | | | | | | | | |
| KMS/cloud credentials | | | | | | | | |
| Alert webhook credentials | | | | | | | | |

| Step | Command / action | Env | Operator | Date | Evidence (redacted) | Pass? |
|------|------------------|-----|----------|------|---------------------|-------|
| Dry-run all devices | `cd backend && npx tsx scripts/rotate-all-device-credentials.ts --dry-run` | | | | | |
| Execute staging | `ROTATE_DEVICES_ALLOW=true npx tsx scripts/rotate-all-device-credentials.ts --execute` | staging | | | | |
| Flash one-shot secrets | Update `config.h` / secure element | | | | | |
| JWT kid overlap | Follow `day1-jwt-rotation-checklist.md` | | | | | |
| Provider keys | Rotate OWM/AccuWeather/OpenAI as needed | | | | | |
| METRICS / ALERT tokens | | | | | | |

## Revocation rehearsal

| Step | Action | Expected | Observed | Pass? |
|------|--------|----------|----------|-------|
| 1 | Revoke credential via admin API | Device ingest → 401 | | |
| 2 | Confirm audit log `credential.revoked` | Present | | |
| 3 | Re-provision new credential | Ingest succeeds | | |
| 4 | Attempt replay of old signed request | Rejected | | |
| 5 | Attempt login/token use with retired JWT key | Rejected after overlap window | | |
| 6 | Attempt database/Redis use with retired credential | Rejected | | |
| 7 | Verify old remote-config signing key is rejected | Rejected after trust-set transition | | |

## Approvals

| Role | Name | Date |
|------|------|------|
| Platform eng | | |
| Security / ops | | |
