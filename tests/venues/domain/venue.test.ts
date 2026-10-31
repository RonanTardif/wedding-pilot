import { describe, expect, it } from "vitest";
import { directionsUrl, sortVenuesByKind, type Venue } from "../../../src/venues/domain/venue";

describe("directionsUrl", () => {
  it("builds a Google Maps directions link with the URI-encoded address", () => {
    expect(directionsUrl("4 allée des Hêtres, 99120 Valombre & Co")).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=4%20all%C3%A9e%20des%20H%C3%AAtres%2C%2099120%20Valombre%20%26%20Co",
    );
  });
});

describe("sortVenuesByKind", () => {
  const venue = (id: string, kind: Venue["kind"]): Venue => ({ id, name: id, kind, address: `${id} address` });

  it("orders cérémonie, cocktail, dîner, hébergement, stable within a kind, without mutating the input", () => {
    const input = [
      venue("hotel-a", "hebergement"),
      venue("dinner", "diner"),
      venue("hotel-b", "hebergement"),
      venue("drinks", "cocktail"),
      venue("ceremony", "ceremonie"),
    ];
    const snapshot = input.map((v) => v.id);
    expect(sortVenuesByKind(input).map((v) => v.id)).toEqual(["ceremony", "drinks", "dinner", "hotel-a", "hotel-b"]);
    expect(input.map((v) => v.id)).toEqual(snapshot);
  });
});
