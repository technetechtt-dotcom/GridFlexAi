# Ops execution sprint (remaining pilot evidence)

Engineering frameworks for gates 7–15 are in-repo. This sprint collects **operator evidence** only. Do not mark a gate complete without a filled worksheet and a log row.

**Commands:** [`operator-command-sheet.md`](./operator-command-sheet.md)  
**Overall tracker:** [`readiness-execution-checklist.md`](./readiness-execution-checklist.md) · [`PRODUCTION_READINESS.md`](../../PRODUCTION_READINESS.md)

## Owners (fill once)

| Role | Name | Contact |
|------|------|---------|
| Platform eng | | |
| Edge ops | | |
| On-call | | |
| Information Officer (POPIA) | | |
| Plant representative | | |

## Sprint order (do not skip)

| Day | Gate | Task | Evidence artifact | Done? |
|-----|------|------|-------------------|-------|
| 1 | 7 | Staging secret rotation (JWT kid overlap + DB/Redis rehearsal) | [`secret-rotation-log.md`](./secret-rotation-log.md) + inventory dates | |
| 1 | 7 | Emergency rotation rehearsal (JWT or device) | Emergency table in rotation log | |
| 2 | 8 | Neon isolated restore drill + `restore:verify` | [`backup-restore-evidence.md`](./backup-restore-evidence.md) | |
| 3 | 9 | Log drain + scrape `/api/metrics` + wire catalog alerts | Drain URL + scrape proof | |
| 3 | 9 | Critical on-call fire-drill | [`../observability/alert-review.md`](../observability/alert-review.md) | |
| 4 | 10 | Promote one image digest staging→prod + parity report | [`parity-promotion-evidence.md`](./parity-promotion-evidence.md) | |
| 5 | 12 | Staging k6 soak (3× pilot) + Socket.IO fan-out | [`../load/evidence-worksheet.md`](../load/evidence-worksheet.md) | |
| 6 | 14 | POPIA IO sign-off + first access review | Policy signature + [`../policies/access-review-log.md`](../policies/access-review-log.md) | |
| 6 | 15 | Physical-execution lock attestation | [`../policies/pilot-physical-execution-lock.md`](../policies/pilot-physical-execution-lock.md) | |
| Ongoing | 11 | Pen-tester SOW / RoE / schedule | [`../PENETRATION_TEST.md`](../PENETRATION_TEST.md) | |
| Site | 4–6 | Vendor map, ESP32 flash, HIL worksheet | Equipment + HIL worksheets | |

---

## Day 1 — Secrets (Gate 7)

### Preconditions
- Staging backend reachable; on-call notified.
- Secret manager access (Render / AWS SM / platform store).
- [`secret-rotation.md`](./secret-rotation.md) open.

### Execute
1. Confirm inventory owners in [`../SECRETS_INVENTORY.md`](../SECRETS_INVENTORY.md).
2. Staging only: rotate JWT with overlapping `kid` (section 4 of secret-rotation runbook).
3. Smoke: login, refresh, authenticated API.
4. Optional same day: rotate staging `DATABASE_URL` / `REDIS_URL` passwords; revoke old.
5. Run emergency rehearsal (simulated JWT exposure): add new kid, drop compromised kid, force re-login, confirm recovery.
6. Append rows to rotation log; set **Last rotated** dates (even if staging-only — note env).

### Exit
- [ ] Rotation log has ≥1 success row and ≥1 emergency rehearsal row  
- [ ] Inventory **Last rotated** no longer `_TBD_` for JWT (and any others rotated)  
- [ ] `npm run check:secrets-hygiene` PASS on current branch  

---

## Day 2 — Backup / restore (Gate 8)

### Preconditions
- Neon project with PITR / history window configured.
- Isolated branch/project available (never restore over primary).

### Execute
1. Follow [`database-backup-restore.md`](./database-backup-restore.md).
2. Create restore branch from PITR or snapshot; new credentials only.
3. Point a **non-prod** backend (or one-off verify) at restore `DATABASE_URL`.
4. Run:
   ```bash
   cd backend
   RESTORE_VERIFY_ALLOW=true DATABASE_URL="postgresql://…restore…" npm run restore:verify
   ```
5. Record RPO/RTO and counts in [`backup-restore-evidence.md`](./backup-restore-evidence.md).
6. Delete or retain restore branch per retention policy.

### Exit
- [ ] Evidence drill section complete with Approver  
- [ ] Achieved RPO ≤ 15m and RTO ≤ 2h (or written waiver)  
- [ ] History table row filled  

---

## Day 3 — Observability (Gate 9)

### Preconditions
- Hosting log drain destination chosen (Better Stack / Datadog / CloudWatch / etc.).
- `METRICS_SCRAPE_TOKEN` set in staging (+ prod when ready).

### Execute
1. Wire stdout JSON logs to the drain; confirm a live line with `event=server.listening` and `traceId`.
2. Scrape Prometheus:
   ```bash
   curl -sH "Authorization: Bearer $METRICS_SCRAPE_TOKEN" https://<staging>/api/metrics | head
   ```
3. Create alert rules from [`../observability/ALERT_CATALOG.md`](../observability/ALERT_CATALOG.md) (minimum: A-health-live, dependency down, 5xx spike, signature failures).
4. Fire-drill: force one controlled failure (invalid edge signature or kill health probe briefly).
5. Confirm log + metric + page to on-call; fill fire-drill table in alert-review.

### Exit
- [ ] Drain URL + sample log link attached (redact secrets)  
- [ ] Metrics scrape returns `gridflex_` series  
- [ ] Fire-drill row: recipient reached = yes  

---

## Day 4 — Parity promotion (Gate 10)

### Preconditions
- CI built an image for the release SHA; digest recorded.
- Staging already running that digest and passed smoke.

### Execute
1. Promote **same** digest to production (do not rebuild).
2. Run:
   ```bash
   npm run check:env-parity
   IMAGE_DIGEST=sha256:… STAGING_SMOKE_RESULT=pass PRODUCTION_SMOKE_RESULT=pass npm run report:parity
   ```
3. Optional: `npm run verify:go-live:staging` / `:production` / `:summary`.
4. Fill [`parity-promotion-evidence.md`](./parity-promotion-evidence.md).

### Exit
- [ ] Staging and prod `imageDigest` match  
- [ ] `go-live-reports/parity-report-latest.json` (+ `.sha256`) exist  
- [ ] Approver signed worksheet  

---

## Day 5 — Load (Gate 12)

### Preconditions
- Staging sized for 3× pilot; Redis up; on-call aware of synthetic load.

### Execute
1. Follow [`../LOAD_TESTING.md`](../LOAD_TESTING.md).
2. Run k6 soak + Socket.IO fan-out (commands on operator sheet).
3. Fill [`../load/evidence-worksheet.md`](../load/evidence-worksheet.md) and capacity notes.

### Exit
- [ ] SLO pass/fail recorded  
- [ ] k6 summary attached  
- [ ] Capacity estimate updated  

---

## Day 6 — Governance locks (Gates 14–15)

### POPIA
1. Information Officer reviews [`../policies/popia-data-handling-policy.md`](../policies/popia-data-handling-policy.md).
2. Sign policy approval block (or attach signed PDF link — no PII dumps).
3. Complete first monthly entry in [`../policies/access-review-log.md`](../policies/access-review-log.md).

### Physical lock
1. Confirm staging + prod: both actuation flags `false`, `PILOT_LOCK_PHYSICAL_EXECUTION=true`.
2. Capture boot log `physicalExecutionArmed: false`.
3. Complete attestation table in [`../policies/pilot-physical-execution-lock.md`](../policies/pilot-physical-execution-lock.md).

### Exit
- [ ] IO name + date on policy  
- [ ] Access-review history row filled  
- [ ] Physical attestation signatures present  

---

## Parallel / site tracks

| Track | Owner | Doc |
|-------|-------|-----|
| Pen-test engagement | Security | [`../PENETRATION_TEST.md`](../PENETRATION_TEST.md) |
| Inverter map + dossier | Edge ops | [`../INVERTER_INTEGRATION.md`](../INVERTER_INTEGRATION.md) |
| ESP32 flash + 24h soak | Edge ops | [`../EDGE_RELIABILITY.md`](../EDGE_RELIABILITY.md) |
| HIL bench sign-off | Edge + plant | [`../equipment/hil-evidence-worksheet.md`](../equipment/hil-evidence-worksheet.md) |

---

## Definition of done (ops sprint)

All Day 1–6 exit checkboxes above are checked, evidence files have real dates (not `_TBD_`), and `PRODUCTION_READINESS.md` P0 ops items can be marked with evidence links.
