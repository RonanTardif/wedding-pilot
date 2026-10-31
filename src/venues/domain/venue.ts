/** Kinds of venue, in the order guests meet them during the wedding. */
export const VENUE_KINDS = ["ceremonie", "cocktail", "diner", "hebergement"] as const;

export type VenueKind = (typeof VENUE_KINDS)[number];

/** A (fictional) place where part of the wedding happens, or where guests sleep. */
export interface Venue {
  /** Stable kebab-case identifier, referenced by other contexts as an opaque string. */
  readonly id: string;
  readonly name: string;
  readonly kind: VenueKind;
  /** Postal address, one line. */
  readonly address: string;
}

const DIRECTIONS_BASE_URL = "https://www.google.com/maps/dir/?api=1&destination=";

/** Google Maps directions link to `address` (no API key, no embed). */
export function directionsUrl(address: string): string {
  return `${DIRECTIONS_BASE_URL}${encodeURIComponent(address)}`;
}

/** Venues ordered by kind (cérémonie, cocktail, dîner, hébergement), keeping input order within a kind; does not mutate the input. */
export function sortVenuesByKind(venues: readonly Venue[]): Venue[] {
  return [...venues].sort((a, b) => VENUE_KINDS.indexOf(a.kind) - VENUE_KINDS.indexOf(b.kind));
}
