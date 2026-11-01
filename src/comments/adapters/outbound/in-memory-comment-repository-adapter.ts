import type { CommentRepositoryPort } from "../../application/comment-repository-port";
import type { Comment } from "../../domain/comment";

/** Keeps comments in process memory (lost on restart); newest first. */
export class InMemoryCommentRepositoryAdapter implements CommentRepositoryPort {
  private readonly comments: Comment[] = [];

  async add(comment: Comment): Promise<void> {
    this.comments.unshift(comment);
  }

  async list(): Promise<readonly Comment[]> {
    return [...this.comments];
  }
}
