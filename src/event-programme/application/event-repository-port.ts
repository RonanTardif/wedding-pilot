import type { WeddingEvent } from "../domain/event";

/** Source of the wedding event and its day programme. */
export interface EventRepositoryPort {
  /** Throws an `EventRepositoryError` when the event cannot be loaded. */
  getEvent(): Promise<WeddingEvent>;
}

export type EventRepositoryErrorCode = "EVENT_DATA_INVALID";

/** Typed error raised by `EventRepositoryPort` implementations (convention `{ code, message, retryable }`). */
export class EventRepositoryError extends Error {
  override readonly name = "EventRepositoryError";
  readonly retryable = false as const;

  constructor(
    readonly code: EventRepositoryErrorCode,
    message: string,
  ) {
    super(message);
  }
}
