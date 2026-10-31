import type { VenueRepositoryPort } from "../../application/venue-repository-port";
import type { Venue } from "../../domain/venue";

export class InMemoryVenueRepositoryAdapter implements VenueRepositoryPort {
  constructor(private readonly venues: readonly Venue[]) {}
  async list(): Promise<readonly Venue[]> {
    return this.venues;
  }
}
