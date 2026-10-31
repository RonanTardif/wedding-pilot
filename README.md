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
  usage-analytics/           bounded context: usage events (POST /api/events -> BigQuery)
    domain/                  pure TypeScript, no external deps
    application/             use cases + ports
    adapters/inbound/        drive the use cases
    adapters/outbound/       implement the ports
tests/architecture/          proves the dependency rules are enforced
contracts/                   vendored Factory contracts (usage-event.v1.json, see contracts/SOURCE.md)
infrastructure/              Terraform: Artifact Registry repo, Cloud Run service, BigQuery events table (applied by CI)
Dockerfile                   Next.js standalone image for Cloud Run
```

The fictional event and its day programme live in `src/event-programme/adapters/outbound/event.json` (validated by `JsonEventRepositoryAdapter`; times are ISO 8601 with offset, displayed in `Europe/Paris`).

The fictional venues live in `src/venues/adapters/outbound/venues.json` (validated by `JsonVenueRepositoryAdapter`; kinds `ceremonie`, `cocktail`, `diner`, `hebergement`). Programme steps reference them by `venueId`; `src/app` resolves the names, and `tests/app/venue-references.test.ts` fails on a dangling reference.

Conventions for contributors and agents: see [CLAUDE.md](./CLAUDE.md).

## Usage events

The page reports anonymous usage to `POST /api/events` (client component `UsageBeacon`, `fetch` with `keepalive`, errors swallowed):

| `event_type` | When | `properties` |
|---|---|---|
| `page_viewed` | once per page load | `{ "path": "/" }` |
| `programme_viewed` | once per page load, when the programme section is at least half visible (or fills half the screen) | `{ "highlighted_step_kind": "current" \| "next" \| "none" }` (omitted when the programme could not load) |

The browser sends only `event_type`, `properties`, `session_id` (random token in `sessionStorage`) and `anonymous_user_id` (random token in `localStorage`); no cookie, no third-party script. The server adds the rest of the envelope (`event_id` = `evt_` + ULID, `occurred_at` = server time UTC, `product_id`, `traffic_source`, `consent_context = {"analytics":"anonymous"}`, `schema_version = 1`) and validates it against the Factory contract vendored in `contracts/usage-event.v1.json`. It never reads the IP, user agent or referrer.

- `traffic_source` is `synthetic` when the request carries `x-atlas-traffic: synthetic` (the Factory's simulated visitors), `real` otherwise.
- Responses: `202` accepted (also when BigQuery is down: analytics never breaks the page), `400` invalid event (unknown type, extra field, free text, bad token), `413` body over 2 KB. Rejections are logged as `usage_event_rejected` with a running count only; sink failures as `usage_event_sink_failed` with an error code only.
- Data lands in BigQuery `atlas-wedding-pilot-rt.analytics.events` (streaming insert with `insertId = event_id`, partitioned by day on `occurred_at`), written by the runtime SA `wedding-app`. The table is managed by `infrastructure/`; the dataset and its IAM by the human `pilot-bootstrap` stack.

```sh
curl -X POST https://<service-url>/api/events -H 'content-type: application/json' -H 'x-atlas-traffic: synthetic' \
  -d '{"event_type":"page_viewed","properties":{"path":"/"},"session_id":"synthetic-session-01","anonymous_user_id":"synthetic-user-01"}'
bq query --use_legacy_sql=false \
  'SELECT event_type, traffic_source, occurred_at FROM `atlas-wedding-pilot-rt.analytics.events` ORDER BY occurred_at DESC LIMIT 10'
```

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

`.github/workflows/ci.yml` (job `ci`) runs on every PR and on `main`: forbidden-key guard, gitleaks secret scan, lint, typecheck, tests, architecture rules, build, Terraform fmt/validate, and a Docker smoke test (`/version`, `/`, `POST /api/events` answering 202 without GCP credentials). It has `contents: read` permissions only.

## Factory build and review (ATLAS agents)

Both workflows run Claude Code through `anthropics/claude-code-action` on Ronan's subscription (`CLAUDE_CODE_OAUTH_TOKEN`, never an API key). The GitHub App token (`ATLAS_APP_ID`, `ATLAS_APP_PRIVATE_KEY` in the `atlas-agents` environment, restricted to `main`) is minted only after the agent has finished.

**`build.yml`** (`workflow_dispatch` on `main`; inputs `run_id`, `mission_id`, `intent`, `mini_spec`, optional `feedback`):

1. validates `run_id` (`run_` + ULID) and `mission_id` (`msn_` + ULID), then writes the inputs to files (`.atlas-run/`), never into a shell command;
2. checks out `atlas/{run_id}/{mission_id}` (created from `main`, or the existing branch merged with `main` when re-dispatched with `feedback`; a merge conflict ends the build as `failed`);
3. runs the build agent (prompt `.github/atlas/build-prompt.md`): file tools and `pnpm lint|typecheck|test|arch|build` only;
4. re-runs `pnpm lint && pnpm typecheck && pnpm test && pnpm arch && pnpm build`, refuses a change under `.github/`;
5. job `agent` (steps 1-4) has no App secret and no environment; it hands a patch to job `publish` (environment `atlas-agents`), which re-checks the `.github/` rule, mints the App token, applies the patch in a fresh clone, pushes with the App token (so `ci` and `review` run), then opens the PR `[{run_id}] <intent>` or comments on the existing one;
6. reports `status` (`succeeded` | `failed` | `rate_limited`), `pr_number`, `head_sha`, `input_tokens`, `output_tokens` as job outputs, in the job summary and in the `atlas-build-result` artifact (`result.json`). `rate_limited` (subscription usage limit) leaves the job green so the caller retries later; `failed` fails the job with the reason.

**`review.yml`** (`pull_request_target` on PRs into `main`):

- PRs from `atlas/{run_id}/{mission_id}` branches of this repo: the workflow and the reviewer's instructions (`.github/atlas/review-prompt.md`, `CLAUDE.md`) come from `main`; the PR head is checked out into `.atlas-pr/` as data (no credentials, instruction files and symlinks removed), never installed or run. The reviewer reads the diff with read-only tools and returns a verdict; the workflow posts it as a review, sets the commit status `atlas-review` (`success` on approval, `failure` on changes requested, `error` if the reviewer did not finish) and, on approval, has the App enable auto-merge (squash, pinned to the reviewed head). The PR then merges once `ci` and `atlas-review` pass, and `deploy.yml` ships it.
- A PR touching a CODEOWNERS path (`infrastructure/`, `CLAUDE.md`, `.claude/`, `.github/`, `scripts/`, `.dependency-cruiser.cjs`, `tests/architecture/`) is never auto-merged: the reviewer's verdict is posted and Ronan is asked to review.
- Any other PR from this repository gets `atlas-review = success` immediately; fork PRs get no status from this workflow.
- GitHub does not let the App approve or request changes on a PR it opened itself; the verdict is then posted as a comment review. The required `atlas-review` status is what gates the merge.

The `protect-main` ruleset requires both `ci` and `atlas-review` (commit statuses from GitHub Actions).

## Deployment

`.github/workflows/deploy.yml` (job `deploy`) runs after `ci` succeeds on a push to `main` (a failed `ci` run never deploys), or by manual dispatch on `main`. A dispatch only redeploys the current `main` head, which the ruleset's required strict `ci` check gates; it does not rerun `ci` itself.

1. skips the run (success, no deploy) when the SHA is no longer the `main` head, so an older `ci` run finishing late never deploys over a newer commit;
2. authenticates to GCP project `atlas-wedding-pilot-rt` as `pilot-deployer` through Workload Identity Federation (no key). The WIF provider only accepts this workflow file on `refs/heads/main`; dispatching it on another branch fails at the auth step;
3. `terraform apply -target` the Artifact Registry repository `wedding-pilot` (europe-west9), which must exist before the push;
4. builds the `Dockerfile` image and pushes `europe-west9-docker.pkg.dev/atlas-wedding-pilot-rt/wedding-pilot/wedding-page:<full git SHA>`;
5. `terraform apply` the public Cloud Run service `wedding-page` (runtime SA `wedding-app`, 0 to 2 instances) with that image and `GIT_SHA=<sha>`;
6. polls `GET /version` until it returns the deployed SHA, then checks that `/` returns 200, and fails otherwise.

The workflow has `contents: read` and `id-token: write` permissions only. Terraform state is in `gs://atlas-wedding-pilot-rt-tfstate/wedding-page/`. The stack in `infrastructure/` manages only the image repository, the Cloud Run service and its public invoker binding, and the BigQuery table `analytics.events`; service accounts, IAM, the `analytics` dataset and WIF belong to the human `pilot-bootstrap` stack in the Factory repo.

### `GET /version`

Returns `{"sha":"<git SHA>"}` (never cached): the commit the running service was deployed from. It reads `GIT_SHA`, set on the Cloud Run service by Terraform; without it (local dev) it returns `{"sha":"unknown"}`. The Factory uses it to prove that a merged SHA is live.

### Rollback

Open a PR that reverts the faulty commit and merge it: `ci` then `deploy` ship the revert like any other change. Do not redeploy by hand or edit the service in the console (Terraform would undo it on the next deploy).

### Local image

```sh
docker build -t wedding-page .
docker run --rm -p 8080:8080 -e GIT_SHA=local wedding-page   # http://localhost:8080/version
```
