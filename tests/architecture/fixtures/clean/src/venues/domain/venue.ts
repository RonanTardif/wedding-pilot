import type { VenueName } from "@/venues/domain/venue-name";

export interface Venue {
  readonly id: string;
  readonly name: VenueName;
}
