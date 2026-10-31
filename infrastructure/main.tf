# Pilot CI stack, applied by pilot-deployer from .github/workflows/deploy.yml (AD-10, AD-19).
# It manages ONLY the Artifact Registry repository, the Cloud Run service and its public
# invoker binding (later: BigQuery tables). Never service accounts, project IAM or the
# analytics dataset: those belong to the human pilot-bootstrap stack.

locals {
  # The image tag is the git SHA; /version reports it from GIT_SHA.
  git_sha = regex("[0-9a-f]{40}$", var.image)
}

resource "google_artifact_registry_repository" "wedding_pilot" {
  project       = var.project_id
  location      = var.region
  repository_id = "wedding-pilot"
  format        = "DOCKER"
  description   = "wedding-pilot images, tagged with the git SHA"

  cleanup_policy_dry_run = false

  # KEEP wins over DELETE: the 10 most recent versions stay, older ones are removed.
  cleanup_policies {
    id     = "keep-10-most-recent"
    action = "KEEP"
    most_recent_versions {
      keep_count = 10
    }
  }

  cleanup_policies {
    id     = "delete-older"
    action = "DELETE"
    condition {
      tag_state = "ANY"
    }
  }
}

resource "google_cloud_run_v2_service" "wedding_page" {
  project  = var.project_id
  location = var.region
  name     = "wedding-page"
  ingress  = "INGRESS_TRAFFIC_ALL"

  deletion_protection = false

  template {
    service_account                  = var.runtime_service_account
    max_instance_request_concurrency = 80
    timeout                          = "10s"

    scaling {
      min_instance_count = 0
      max_instance_count = var.max_instances
    }

    containers {
      image = var.image

      ports {
        container_port = 8080
      }

      env {
        name  = "GIT_SHA"
        value = local.git_sha
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
        cpu_idle          = true
        startup_cpu_boost = true
      }

      startup_probe {
        http_get {
          path = "/version"
        }
        period_seconds    = 2
        failure_threshold = 15
        timeout_seconds   = 1
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  depends_on = [google_artifact_registry_repository.wedding_pilot]
}

# Public page: anyone may invoke the service.
resource "google_cloud_run_v2_service_iam_member" "public" {
  project  = google_cloud_run_v2_service.wedding_page.project
  location = google_cloud_run_v2_service.wedding_page.location
  name     = google_cloud_run_v2_service.wedding_page.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
