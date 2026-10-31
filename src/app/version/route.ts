// Inbound adapter: reports the git SHA this instance was deployed from.
// GIT_SHA is set on the Cloud Run service by Terraform (infrastructure/main.tf), not baked into the image.
export const dynamic = "force-dynamic";

export function GET(): Response {
  const sha = process.env.GIT_SHA?.trim() || "unknown";
  return Response.json({ sha }, { headers: { "Cache-Control": "no-store" } });
}
