# Day 1 — JWT rotation checklist (Gate 7)

Execute on **staging first**. Do not paste secret values into git, tickets, or chat.

Project context: Render backend env (or equivalent) + Neon `gridflex` (`odd-truth-63844972`).

## Preflight (done in-repo)

- [x] `cd backend && npm run check:secrets-hygiene` → OK
- [x] `npm run check:env-parity` → PASS (47/47 keys)
- [ ] Staging URL known: `https://________________`
- [ ] On-call notified
- [ ] Current staging `JWT_ACTIVE_KID` noted (often `legacy`)

## Generate rotation material

From repo root (prints to stdout only — **do not redirect into a tracked file**):

```bash
node scripts/generate-jwt-rotation-snippet.mjs --from-kid legacy --to-kid v2
```

If you can safely pass the current secret on your machine only:

```bash
node scripts/generate-jwt-rotation-snippet.mjs --from-kid legacy --to-kid v2 --previous-secret "<CURRENT_JWT_SECRET>"
```

## Staging apply (Render)

1. Open staging backend → Environment.
2. Set from the snippet:
   - `JWT_ACTIVE_KID`
   - `JWT_SECRET` (new)
   - `JWT_SECRETS_JSON` with **both** old and new kids  
     **or** `JWT_PREVIOUS_SECRET` + `JWT_PREVIOUS_KID`
3. Save → Redeploy.
4. Smoke:
   ```bash
   STAGING_GO_LIVE_BASE_URL=https://<staging> STAGING_GO_LIVE_EMAIL=<admin> STAGING_GO_LIVE_PASSWORD=<password> npm run verify:go-live:staging
   ```
5. Confirm an existing session still works (old kid) **and** a fresh login works (new kid).

## Emergency rehearsal (same day)

1. Simulate exposure: remove the **old** kid from the keyring (or rotate again dropping compromised kid).
2. Confirm old sessions fail; new login succeeds.
3. Restore overlapping kids if this was only a rehearsal, **or** leave the emergency kid active and document.

## Evidence

Fill [`secret-rotation-log.md`](./secret-rotation-log.md):

| Timestamp (UTC) | Operator | Secret(s) | Environment | Result | Notes |
|-----------------|----------|-----------|-------------|--------|-------|
| | | JWT kid legacy→v2 | staging | | Day 1 rehearsal |

Update **Last rotated** for JWT rows in [`../SECRETS_INVENTORY.md`](../SECRETS_INVENTORY.md).

## Exit

- [ ] Staging rotation succeeded  
- [ ] Emergency rehearsal logged  
- [ ] Inventory dates updated  
- [ ] No secrets committed (`git status` clean of `.env`)  
