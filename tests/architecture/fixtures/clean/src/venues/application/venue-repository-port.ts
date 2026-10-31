import type { Venue } from "../domain/venue";

export interface VenueRepositoryPort {
  list(): Promise<readonly Venue[]>;
}
