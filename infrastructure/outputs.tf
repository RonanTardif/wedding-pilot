output "service_url" {
  description = "Public URL of the wedding page (GET /version returns the deployed SHA)."
  value       = google_cloud_run_v2_service.wedding_page.uri
}

output "image_repository" {
  description = "Docker repository the deploy workflow pushes to."
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.wedding_pilot.repository_id}"
}

output "deployed_sha" {
  description = "Git SHA set as GIT_SHA on the service."
  value       = local.git_sha
}
