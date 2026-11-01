import { validateComment, type Comment, type CommentRejection } from "../domain/comment";
import type { CommentRepositoryPort } from "./comment-repository-port";

export type PostCommentResult =
  | { readonly ok: true; readonly comment: Comment }
  | { readonly ok: false; readonly reason: CommentRejection };

export type PostComment = (author: string, message: string) => Promise<PostCommentResult>;
export type ListComments = () => Promise<readonly Comment[]>;

export interface CommentWallDeps {
  readonly repository: CommentRepositoryPort;
  readonly now: () => Date;
  readonly newId: () => string;
}

/** Use case: a visitor leaves a comment (no authentication, no moderation). */
export function createPostComment({ repository, now, newId }: CommentWallDeps): PostComment {
  return async function postComment(author, message) {
    const checked = validateComment(author, message);
    if (!checked.ok) return checked;
    const comment: Comment = { id: newId(), author: checked.author, message: checked.message, createdAt: now() };
    await repository.add(comment);
    return { ok: true, comment };
  };
}

/** Use case: the comments of the wall, newest first. */
export function createListComments(repository: CommentRepositoryPort): ListComments {
  return () => repository.list();
}
