import type { Comment } from "../domain/comment";

export interface CommentRepositoryPort {
  add(comment: Comment): Promise<void>;
  /** All comments, newest first. */
  list(): Promise<readonly Comment[]>;
}
