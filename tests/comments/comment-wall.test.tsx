import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CommentWall } from "../../src/comments/adapters/inbound/comment-wall";
import { InMemoryCommentRepositoryAdapter } from "../../src/comments/adapters/outbound/in-memory-comment-repository-adapter";
import { createListComments, createPostComment } from "../../src/comments/application/comment-wall";
import { validateComment } from "../../src/comments/domain/comment";

function setup() {
  const repository = new InMemoryCommentRepositoryAdapter();
  let n = 0;
  const postComment = createPostComment({
    repository,
    now: () => new Date("2030-01-01T10:00:00Z"),
    newId: () => `c${++n}`,
  });
  return { postComment, listComments: createListComments(repository) };
}

describe("validateComment", () => {
  it("accepts a message of exactly 10 characters and trims", () => {
    expect(validateComment("  Alice ", " 0123456789 ")).toEqual({ ok: true, author: "Alice", message: "0123456789" });
  });

  it.each([
    ["", "salut", "author-empty"],
    ["A".repeat(41), "salut", "author-too-long"],
    ["Alice", "   ", "message-empty"],
    ["Alice", "01234567890", "message-too-long"],
  ])("rejects (%j, %j) as %s", (author, message, reason) => {
    expect(validateComment(author, message)).toEqual({ ok: false, reason });
  });
});

describe("comment wall use cases", () => {
  it("lists posted comments, newest first, without authentication", async () => {
    const { postComment, listComments } = setup();
    await postComment("Alice", "Bravo !");
    await postComment("Bob", "Félicit.");
    expect((await listComments()).map((c) => [c.author, c.message])).toEqual([
      ["Bob", "Félicit."],
      ["Alice", "Bravo !"],
    ]);
  });

  it("does not store a message over 10 characters", async () => {
    const { postComment, listComments } = setup();
    expect(await postComment("Alice", "trop long pour le mur")).toEqual({ ok: false, reason: "message-too-long" });
    expect(await listComments()).toHaveLength(0);
  });
});

describe("CommentWall", () => {
  it("renders the form capped at 10 characters and the comments", () => {
    const html = renderToStaticMarkup(
      <CommentWall
        action="/api/comments"
        comments={[{ id: "1", author: "Alice <b>", message: "Bravo", createdAt: new Date() }]}
      />,
    );
    expect(html).toContain("Mur de commentaires");
    expect(html).toMatch(/<input[^>]*name="message"[^>]*/);
    expect(html.match(/<input[^>]*name="message"[^>]*>/)?.[0]).toContain('maxLength="10"');
    expect(html).toContain("Alice &lt;b&gt;");
    expect(html).toContain("Bravo");
  });

  it("shows fallback messages", () => {
    expect(renderToStaticMarkup(<CommentWall action="/x" comments={[]} />)).toContain("Aucun commentaire");
    expect(renderToStaticMarkup(<CommentWall action="/x" comments={null} failed />)).toContain("indisponibles");
  });
});
