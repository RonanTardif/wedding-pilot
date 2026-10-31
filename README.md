# wedding-pilot

ATLAS v0 pilot app: a public, mobile-friendly page for a **fictional** wedding. It is built and evolved by agents of the ATLAS Factory, through pull requests only. All content is fictional.

## Stack

Node.js 26, pnpm 12.16.1 (corepack), TypeScript 6.0.3, Next.js 16.4.3 (App Router), Vitest, ESLint (typescript-eslint), dependency-cruiser 18.7.0.

## Structure

```
src/
  app/                       Next.js shell (inbound adapter, composition root)
  event-programme/           bounded context: day programme
  venues/                    bounded context: wedding venues
    domain/                  pure TypeScript, no external deps
    application/             use cases + ports
    adapters/inbound/        drive the use cases
    adapters/outbound/       implement the ports
tests/architecture/          proves the dependency rules are enforced
```

Conventions for contributors and agents: see [CLAUDE.md](./CLAUDE.md).

## Commands

```sh
# Node >= 25 no longer ships corepack: npm install --global corepack@0.36.0
corepack enable
pnpm install --frozen-lockfile
pnpm dev          # local server on http://localhost:3000
pnpm lint         # ESLint
pnpm typecheck    # tsc --noEmit
pnpm test         # Vitest (unit + architecture rule tests)
pnpm arch         # dependency-cruiser on src/
pnpm build        # next build
```

## CI

`.github/workflows/ci.yml` (job `ci`) runs on every PR and on `main`: forbidden-key guard, gitleaks secret scan, lint, typecheck, tests, architecture rules, build. It has `contents: read` permissions only.
