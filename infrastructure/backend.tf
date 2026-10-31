# State lives in the pilot's own bucket (created by the human pilot-bootstrap stack, AD-10),
# under its own prefix. pilot-bootstrap uses the prefix "pilot-bootstrap" in the same bucket.
terraform {
  backend "gcs" {
    bucket = "atlas-wedding-pilot-rt-tfstate"
    prefix = "wedding-page"
  }
}
