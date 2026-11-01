// Inbound adapter: a visitor posts a comment from the wall form, then goes back to the page.
import { createPostComment } from "../../../comments/application/comment-wall";
import { commentWall } from "../../comment-wall-instance";

export const dynamic = "force-dynamic";

const postComment = createPostComment({
  repository: commentWall.repository,
  now: () => new Date(),
  newId: () => crypto.randomUUID(),
});

export async function POST(request: Request): Promise<Response> {
  let author = "";
  let message = "";
  try {
    const form = await request.formData();
    author = String(form.get("author") ?? "");
    message = String(form.get("message") ?? "");
  } catch {
    // unreadable body: treated as an empty comment, rejected below
  }
  const result = await postComment(author, message);
  // Relative Location: behind Cloud Run, request.url holds the internal host, not the public one.
  const target = result.ok ? "/#comments" : "/?comment=invalid#comments";
  return new Response(null, { status: 303, headers: { Location: target } });
}
