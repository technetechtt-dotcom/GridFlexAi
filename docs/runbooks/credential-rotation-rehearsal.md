# Credential rotation & revocation rehearsal log

Record **evidence without secret values**. Status remains Open until rows are filled after a real staging/production rehearsal.

## Preconditions

- [ ] `EDGE_ALLOW_LEGACY_SHARED_SECRET=false` on target environment
- [ ] `DEVICE_SECRET_VAULT_PROVIDER=aws_kms` (+ key id)
- [ ] Redis available for replay nonces
- [ ] Physical execution flags remain **false** / pilot lock **true**

## Rotation run

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

## Approvals

| Role | Name | Date |
|------|------|------|
| Platform eng | | |
| Security / ops | | |
