# External penetration test (Phase 11)

**Only test systems for which written authorization has been obtained.**

Live destructive plant-control testing is **out of scope**. Physical command execution remains disabled for the pilot.

## Program artifacts

| Artifact | Path |
|----------|------|
| Written authorization + scope | [`docs/pentest/authorization-and-scope.md`](./pentest/authorization-and-scope.md) |
| Rules of engagement | [`docs/pentest/rules-of-engagement.md`](./pentest/rules-of-engagement.md) |
| Independent tester selection | [`docs/pentest/tester-selection.md`](./pentest/tester-selection.md) |
| API / attack-surface inventory | [`docs/pentest/api-surface-inventory.md`](./pentest/api-surface-inventory.md) |
| Test account provisioning brief | [`docs/pentest/test-accounts.md`](./pentest/test-accounts.md) |
| Remediation tracker (by severity) | [`docs/pentest/remediation-tracker.md`](./pentest/remediation-tracker.md) |
| Retest checklist | [`docs/pentest/retest-checklist.md`](./pentest/retest-checklist.md) |

## Vendor package contents (software prep)

Hand the tester (after signed authorization):

- [x] API surface inventory
- [x] Test-account provisioning brief
- [ ] Filled hosts / windows in authorization + RoE
- [ ] Isolated staging (or restore) credentials out of band
- [ ] Architecture pointer: `docs/ARCHITECTURE.md` (if present) + device HMAC notes in `docs/DEVICE_PROVISIONING.md`

## Remediation deadlines

| Severity | Deadline |
|----------|----------|
| Critical | Immediately |
| High | Before pilot go-live |
| Medium | Planned; risk acceptance documented if open |
| Low | Backlog with named owner |

## Acceptance

- [ ] Written authorization and scope signed
- [ ] No unresolved **critical** or **high** findings
- [ ] Tenant isolation and device authentication explicitly tested
- [ ] Independent retest closed critical/high
- [ ] Signed remediation/retest report retained (secure store; not in public Git if it contains findings detail)

Retain the final PDF/report under the org security evidence vault; link the ticket ID in the remediation tracker.
