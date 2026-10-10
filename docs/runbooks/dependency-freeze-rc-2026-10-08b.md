# Dependency freeze — restore from RC-2026-10-08b

On 2026-10-11 a batch of Dependabot major upgrades landed on `main` and broke clean installs:

- React 19 + React DOM 18 mismatch
- Tailwind CSS 4 with Tailwind 3 PostCSS/`@import` setup
- TypeScript 7 with `ts-jest` peer range `<7`
- Prisma / ioredis / Vite / AI SDK majors mixed without staged validation

## Policy
1. Keep runtime dependencies aligned with annotated tag `rc-2026-10-08b` until a staged upgrade PR is green.
2. Do not merge Dependabot majors without green CI and a smoke build (`npm ci`, frontend `build`, backend `typecheck` + tests).
3. Prefer one upgrade group per PR (React, Tailwind, TypeScript, Prisma, Redis client).

## Restored set (high level)
| Area | Pin |
|------|-----|
| React / React DOM / types | 18.3.x |
| Tailwind | 3.4.17 |
| Vite | 7.3.x |
| TypeScript (front/back) | 5.x |
| Prisma / client | 6.x |
| ioredis | 5.x |
| Express | 4.x |

## Release identity
`/api/health` exposes `release.gitSha` and `release.imageDigest` from `RELEASE_GIT_SHA` / `RELEASE_IMAGE_DIGEST`. Source-built Render Node services leave these null — pin the Cosign digest service per `staging-rc-digest-deploy.md`.
