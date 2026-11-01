export const MAX_MESSAGE_LENGTH = 10;
export const MAX_AUTHOR_LENGTH = 40;

export interface Comment {
  readonly id: string;
  readonly author: string;
  readonly message: string;
  readonly createdAt: Date;
}

export type CommentRejection = "author-empty" | "author-too-long" | "message-empty" | "message-too-long";

export type CommentValidation =
  | { readonly ok: true; readonly author: string; readonly message: string }
  | { readonly ok: false; readonly reason: CommentRejection };

const length = (text: string): number => Array.from(text).length;

/** Validates a raw author name and message (trimmed; message at most 10 characters). */
export function validateComment(rawAuthor: string, rawMessage: string): CommentValidation {
  const author = rawAuthor.trim();
  const message = rawMessage.trim();
  if (author === "") return { ok: false, reason: "author-empty" };
  if (length(author) > MAX_AUTHOR_LENGTH) return { ok: false, reason: "author-too-long" };
  if (message === "") return { ok: false, reason: "message-empty" };
  if (length(message) > MAX_MESSAGE_LENGTH) return { ok: false, reason: "message-too-long" };
  return { ok: true, author, message };
}
