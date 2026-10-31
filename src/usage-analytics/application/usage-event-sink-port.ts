import type { UsageEvent } from "../domain/usage-event";

/** Where validated usage events are written (the analytics dataset in production). */
export interface UsageEventSinkPort {
  /** Throws a `UsageEventSinkError` when the event could not be written. */
  write(event: UsageEvent): Promise<void>;
}

export type UsageEventSinkErrorCode = "SINK_UNAVAILABLE" | "SINK_ROW_REJECTED" | "SINK_TIMEOUT";

/** Typed error raised by `UsageEventSinkPort` implementations (convention `{ code, message, retryable }`). */
export class UsageEventSinkError extends Error {
  override readonly name = "UsageEventSinkError";

  constructor(
    readonly code: UsageEventSinkErrorCode,
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}
