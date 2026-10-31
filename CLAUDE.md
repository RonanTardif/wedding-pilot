# CLAUDE.md — wedding-pilot

Instructions for build agents (and humans) working in this repo. The pilot is the ATLAS v0 product: a public page for a **fictional** wedding. The Factory changes it **only through pull requests**.

## Architecture (AD-21: DDD + hexagonal)

Each bounded context lives in `src/<context>/` with exactly these layers:

| Layer | Role | May import |
|-------|------|-----------|
| `domain/` | Entities, value objects, pure domain rules | only files of its own `domain/` (relative imports). No npm package, no Node core module, no framework (`next`, `react`, `@google-cloud/*`, ...) |
| `application/` | Use cases and ports | its own `domain/` and `application/` (local files only, no external package) |
| `adapters/inbound/` | Drive use cases (HTTP, server components) | its own context |
| `adapters/outbound/` | Implement ports (storage, APIs, analytics) | its own context, external packages |

- `src/app/` is the Next.js App Router shell: an inbound adapter and the **composition root**. It is the only place allowed to combine several contexts.
- A context **never** imports any path of another context (not even its adapters), nor `src/app/`.
- No circular dependencies; every import must resolve.
- Rules live in `.dependency-cruiser.cjs` and run with `pnpm arch` in CI; a violation fails the PR. Do not weaken a rule to make a change pass — fix the design.
- Current contexts: `event-programme`, `venues`, `usage-analytics`.

## Naming

- Contexts: kebab-case (`event-programme`).
- Ports: `<Name>Port` (e.g. `VenueRepositoryPort`), declared in `application/`.
- Adapters: `<Tech><Name>Adapter` (e.g. `BigQueryUsageEventAdapter`, `InMemoryVenueRepositoryAdapter`), in `adapters/outbound/` or `adapters/inbound/`.
- Files: kebab-case (`venue-repository-port.ts`).

## Tests

- Domain and application logic get unit tests (Vitest) **without infrastructure**: no network, no GCP, no Next.js runtime; use in-memory adapters.
- Place tests next to the code (`*.test.ts`) or under `tests/`.
- `tests/architecture/` proves the dependency rules bite; its `fixtures/` are deliberately broken and excluded from `lint`, `typecheck` and `arch`.

## Workflow

- Branch name for Factory runs: `atlas/{run_id}/{mission_id}`. Never push to `main`; open a PR.
- Before pushing: `pnpm lint && pnpm typecheck && pnpm test && pnpm arch && pnpm build`.
- Toolchain is pinned (Node 26, pnpm 12.16.1 via corepack, exact dependency versions). Use `pnpm install --frozen-lockfile` and commit `pnpm-lock.yaml` with any dependency change.

## Deployment

- Merged to `main` + `ci` green => `.github/workflows/deploy.yml` builds the image (tag = full git SHA), applies `infrastructure/` (Artifact Registry repo + public Cloud Run service `wedding-page`, europe-west9) and checks `GET /version`.
- `GET /version` (`src/app/version/route.ts`) returns `{"sha": "<deployed SHA>"}` from `GIT_SHA`, or `"unknown"` locally. Keep its contract: the Factory relies on it to prove a merged SHA is live.
- Rollback = a PR reverting the commit; CI redeploys it.
- `infrastructure/` manages only the image repository, the Cloud Run service (+ its public invoker binding) and the BigQuery tables inside `analytics` (today `analytics.events`). Never service accounts, project IAM, the `analytics` dataset (nor its IAM) or WIF: those live in the human `pilot-bootstrap` stack.

## Hard rules

- **No real data.** Names, places, dates and guests are fictional. Never copy content from other repositories (including `app-mariage-v2`).
- **Never add an Anthropic API key** (the `ANTHROPIC` + `_API_KEY` variable, in any spelling) anywhere: code, config, workflows, secrets, docs. CI (`scripts/guard-forbidden-key.sh`) fails if the name appears anywhere in the repo.
- Never commit secrets; CI runs a gitleaks scan.
- CI workflows keep `permissions: contents: read`. Do not add write permissions. The only exception is `deploy.yml`, which also has `id-token: write` (WIF to GCP) and nothing more.
- Never deploy by hand and never add a GCP key or JSON credential: deployment happens only through `deploy.yml` after `ci` passes on `main`.
- `infrastructure/**`, `CLAUDE.md`, `.claude/**`, `.github/**`, `scripts/**`, `.dependency-cruiser.cjs` and `tests/architecture/**` are owned by @RonanTardif (CODEOWNERS) and need his review.
