import { InMemoryCommentRepositoryAdapter } from "../comments/adapters/outbound/in-memory-comment-repository-adapter";

// One shared repository per server process, used by the page (read) and the API route (write).
const globalForComments = globalThis as typeof globalThis & { __commentWall?: { repository: InMemoryCommentRepositoryAdapter } };

export const commentWall = (globalForComments.__commentWall ??= { repository: new InMemoryCommentRepositoryAdapter() });
