# GCIP / production readiness status

| Area | Status | Notes |
|------|--------|-------|
| Release identity (staging) | Improved | Source builds auto-pick `RENDER_GIT_COMMIT` / `GITHUB_SHA` into `RELEASE_GIT_SHA`; digest still optional |
| Release identity (production) | Required | `gridflex-backend-prod` digest-pinned Docker, Cosign verify, `REQUIRE_RELEASE_IDENTITY=true` |
| Deployment records | Done | `DeploymentRecord` written on boot |
| Login wording | Done | No military-grade claim; invite-only messaging |
| Clear pilot case | Done | `/pilot-case` — Prieska retrospective evidence pack |
| Climate-impact calculator | Done | `/climate-impact` measured/modelled/estimated/potential |
| Commercial dashboard | Done | `/commercial-value` fee + payback model |
| AI evidence | Done | `/ai-evidence` methodology (not threshold-as-AI) |
| Verified pilot PDF | Done | Manager/investor HTML→PDF with approval record |
| IP positioning | Done | `docs/competition/IP-positioning.md` |
| Offline demo fallback | Done | Embedded pack + `/gcip` warmup |
| Demo account | Documented | `docs/competition/GCIP-demo-account.md` |
| Operator decisions / recovery | Done | PostgreSQL |
| Alarm / work-order / onboarding / DQ | Done | Prior release |
| Navigation IA | Done | Presentation pack under demo mode; GCIP banner |
| Projector readability | Done | `html.gf-projector` larger type |
| Account workflow | Partial | Invite/session/suspend; self-serve email reset still admin-mediated |
| Lint / Playwright / pen-test | Remaining | `npm run lint`, `npm run e2e`, `npm run test:routes` |

## Judge entry point

`/gcip?demo=1` → Pilot case → Climate → Commercial → AI evidence → Verified PDF.
