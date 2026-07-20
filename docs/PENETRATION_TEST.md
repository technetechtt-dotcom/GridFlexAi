# External penetration test (Phase 11)

**Only test systems for which written authorization has been obtained.**

Live destructive plant-control testing is **out of scope**. Physical command execution remains disabled for the pilot.

## Program artifacts

| Artifact | Path |
|----------|------|
| Written authorization + scope | [`docs/pentest/authorization-and-scope.md`](./pentest/authorization-and-scope.md) |
| Rules of engagement | [`docs/pentest/rules-of-engagement.md`](./pentest/rules-of-engagement.md) |
| Independent tester selection | [`docs/pentest/tester-selection.md`](./pentest/tester-selection.md) |
| Remediation tracker (by severity) | [`docs/pentest/remediation-tracker.md`](./pentest/remediation-tracker.md) |
| Retest checklist | [`docs/pentest/retest-checklist.md`](./pentest/retest-checklist.md) |

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
