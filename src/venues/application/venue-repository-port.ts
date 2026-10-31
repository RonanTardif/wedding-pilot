import type { Venue } from "../domain/venue";

/** Source of the wedding venues. */
export interface VenueRepositoryPort {
  /** Throws a `VenueRepositoryError` when the venues cannot be loaded. */
  listVenues(): Promise<readonly Venue[]>;
}

export type VenueRepositoryErrorCode = "VENUE_DATA_INVALID";

/** Typed error raised by `VenueRepositoryPort` implementations (convention `{ code, message, retryable }`). */
export class VenueRepositoryError extends Error {
  override readonly name = "VenueRepositoryError";
  readonly retryable = false as const;

  constructor(
    readonly code: VenueRepositoryErrorCode,
    message: string,
  ) {
    super(message);
  }
}
