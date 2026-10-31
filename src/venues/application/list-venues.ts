import { directionsUrl, sortVenuesByKind, type Venue } from "../domain/venue";
import type { VenueRepositoryPort } from "./venue-repository-port";

/** A venue as shown to guests, with its directions link. */
export interface ListedVenue extends Venue {
  readonly directionsUrl: string;
}

export type ListVenues = () => Promise<readonly ListedVenue[]>;

/** Use case: the wedding venues, ordered by kind (cérémonie, cocktail, dîner, hébergement). */
export function createListVenues(repository: VenueRepositoryPort): ListVenues {
  return async function listVenues(): Promise<readonly ListedVenue[]> {
    const venues = await repository.listVenues();
    return sortVenuesByKind(venues).map((venue) => ({ ...venue, directionsUrl: directionsUrl(venue.address) }));
  };
}
