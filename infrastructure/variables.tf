variable "project_id" {
  description = "Pilot GCP project (created by the human pilot-bootstrap stack)."
  type        = string
  default     = "atlas-wedding-pilot-rt"
}

variable "region" {
  description = "Region of the Artifact Registry repository and the Cloud Run service."
  type        = string
  default     = "europe-west9"
}

variable "image" {
  description = "Full image reference to deploy, tagged with the full 40-char git SHA: <region>-docker.pkg.dev/<project>/wedding-pilot/wedding-page:<sha>."
  type        = string

  validation {
    condition     = can(regex(":[0-9a-f]{40}$", var.image))
    error_message = "image must be tagged with the full 40-char lowercase git SHA."
  }
}

variable "runtime_service_account" {
  description = "Runtime SA of the Cloud Run service (created by pilot-bootstrap, never by this stack)."
  type        = string
  default     = "wedding-app@atlas-wedding-pilot-rt.iam.gserviceaccount.com"
}

variable "max_instances" {
  description = "Upper bound on Cloud Run instances (budget guard)."
  type        = number
  default     = 2
}
