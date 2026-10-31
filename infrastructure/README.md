# infrastructure (pilot CI stack)

Terraform for the wedding page, applied **only** by `.github/workflows/deploy.yml` as
`pilot-deployer` (Workload Identity Federation, no key). Terraform 1.17.1, provider google 8.9.0.
State: `gs://atlas-wedding-pilot-rt-tfstate/wedding-page/`.

## What it manages

- Artifact Registry repository `wedding-pilot` (Docker, europe-west9). Cleanup policy: the 10 most
  recent versions are kept, older ones are deleted.
- Cloud Run service `wedding-page` (europe-west9): runtime SA `wedding-app`, image
  `…/wedding-pilot/wedding-page:<git SHA>`, env `GIT_SHA` derived from the image tag, 0 to 2
  instances, 1 vCPU / 512 MiB, public ingress.
- `allUsers` -> `roles/run.invoker` on that service (the page is public).

## What it never manages

Service accounts, project IAM, the `analytics` dataset and its access, WIF, APIs and the state
bucket. They belong to the human `pilot-bootstrap` stack (Factory repo). A resource belongs to
exactly one stack.

## How CI applies it

```sh
terraform -chdir=infrastructure init -lockfile=readonly
# The repository must exist before the image push:
terraform -chdir=infrastructure apply -target=google_artifact_registry_repository.wedding_pilot -var image=<image>
docker build -t <image> . && docker push <image>
terraform -chdir=infrastructure apply -var image=<image>
```

`<image>` must end with `:<40-char git SHA>` (validated). Do not apply by hand: rollback is a
revert PR, redeployed by CI.
