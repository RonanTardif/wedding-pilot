import { describe, expect, it } from "vitest";
import type { Venue } from "../../../src/venues/domain/venue";
import { VenueRepositoryError, type VenueRepositoryPort } from "../../../src/venues/application/venue-repository-port";
import { createListVenues } from "../../../src/venues/application/list-venues";

class InMemoryVenueRepositoryAdapter implements VenueRepositoryPort {
  constructor(private readonly venues: readonly Venue[]) {}
  async listVenues(): Promise<readonly Venue[]> {
    return this.venues;
  }
}

const venues: Venue[] = [
  { id: "gite", name: "Gîte", kind: "hebergement", address: "1 rue A, 99000 Nulle-Part" },
  { id: "grange", name: "Grange", kind: "diner", address: "2 rue B, 99000 Nulle-Part" },
  { id: "jardin", name: "Jardin", kind: "ceremonie", address: "3 rue C, 99000 Nulle-Part" },
  { id: "orangerie", name: "Orangerie", kind: "cocktail", address: "4 rue D, 99000 Nulle-Part" },
];

describe("listVenues", () => {
  it("returns venues ordered by kind, each with its directions link", async () => {
    const listed = await createListVenues(new InMemoryVenueRepositoryAdapter(venues))();
    expect(listed.map((v) => v.id)).toEqual(["jardin", "orangerie", "grange", "gite"]);
    expect(listed[0]).toEqual({
      id: "jardin",
      name: "Jardin",
      kind: "ceremonie",
      address: "3 rue C, 99000 Nulle-Part",
      directionsUrl: "https://www.google.com/maps/dir/?api=1&destination=3%20rue%20C%2C%2099000%20Nulle-Part",
    });
  });

  it("propagates repository errors", async () => {
    const failing: VenueRepositoryPort = {
      listVenues: () => Promise.reject(new VenueRepositoryError("VENUE_DATA_INVALID", "broken")),
    };
    await expect(createListVenues(failing)()).rejects.toMatchObject({ code: "VENUE_DATA_INVALID", retryable: false });
  });
});
