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
infrastructure/              Terraform: Artifact Registry repo + Cloud Run service (applied by CI)
Dockerfile                   Next.js standalone image for Cloud Run
```

The fictional event and its day programme live in `src/event-programme/adapters/outbound/event.json` (validated by `JsonEventRepositoryAdapter`; times are ISO 8601 with offset, displayed in `Europe/Paris`).

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

## Deployment

`.github/workflows/deploy.yml` (job `deploy`) runs after `ci` succeeds on a push to `main` (a failed `ci` run never deploys), or by manual dispatch on `main`. A dispatch only redeploys the current `main` head, which the ruleset's required strict `ci` check gates; it does not rerun `ci` itself.

1. skips the run (success, no deploy) when the SHA is no longer the `main` head, so an older `ci` run finishing late never deploys over a newer commit;
2. authenticates to GCP project `atlas-wedding-pilot-rt` as `pilot-deployer` through Workload Identity Federation (no key). The WIF provider only accepts this workflow file on `refs/heads/main`; dispatching it on another branch fails at the auth step;
3. `terraform apply -target` the Artifact Registry repository `wedding-pilot` (europe-west9), which must exist before the push;
4. builds the `Dockerfile` image and pushes `europe-west9-docker.pkg.dev/atlas-wedding-pilot-rt/wedding-pilot/wedding-page:<full git SHA>`;
5. `terraform apply` the public Cloud Run service `wedding-page` (runtime SA `wedding-app`, 0 to 2 instances) with that image and `GIT_SHA=<sha>`;
6. polls `GET /version` until it returns the deployed SHA, then checks that `/` returns 200, and fails otherwise.

The workflow has `contents: read` and `id-token: write` permissions only. Terraform state is in `gs://atlas-wedding-pilot-rt-tfstate/wedding-page/`. The stack in `infrastructure/` manages only the image repository, the Cloud Run service and its public invoker binding; service accounts, IAM, the `analytics` dataset and WIF belong to the human `pilot-bootstrap` stack in the Factory repo.

### `GET /version`

Returns `{"sha":"<git SHA>"}` (never cached): the commit the running service was deployed from. It reads `GIT_SHA`, set on the Cloud Run service by Terraform; without it (local dev) it returns `{"sha":"unknown"}`. The Factory uses it to prove that a merged SHA is live.

### Rollback

Open a PR that reverts the faulty commit and merge it: `ci` then `deploy` ship the revert like any other change. Do not redeploy by hand or edit the service in the console (Terraform would undo it on the next deploy).

### Local image

```sh
docker build -t wedding-page .
docker run --rm -p 8080:8080 -e GIT_SHA=local wedding-page   # http://localhost:8080/version
```
