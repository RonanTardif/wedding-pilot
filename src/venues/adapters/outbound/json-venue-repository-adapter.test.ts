import { describe, expect, it } from "vitest";
import { VenueRepositoryError } from "../../application/venue-repository-port";
import { VENUE_KINDS } from "../../domain/venue";
import { JsonVenueRepositoryAdapter } from "./json-venue-repository-adapter";

const validVenue = { id: "ferme-des-essais", name: "Ferme des Essais", kind: "diner", address: "1 chemin du Test, 99000 Nulle-Part" };

function without(value: object, key: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([k]) => k !== key));
}

async function expectInvalid(raw: unknown) {
  const error = await new JsonVenueRepositoryAdapter(raw).listVenues().then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(VenueRepositoryError);
  expect(error).toMatchObject({ code: "VENUE_DATA_INVALID", retryable: false });
  expect((error as VenueRepositoryError).message).toEqual(expect.any(String));
}

describe("JsonVenueRepositoryAdapter", () => {
  it("loads the bundled fictional venues: 4 to 5 venues, at least one of each kind", async () => {
    const venues = await new JsonVenueRepositoryAdapter().listVenues();
    expect(venues.length).toBeGreaterThanOrEqual(4);
    expect(venues.length).toBeLessThanOrEqual(5);
    for (const kind of VENUE_KINDS) expect(venues.some((v) => v.kind === kind)).toBe(true);
  });

  it("maps a valid venue as is", async () => {
    expect(await new JsonVenueRepositoryAdapter({ venues: [validVenue] }).listVenues()).toEqual([validVenue]);
  });

  it("throws a typed error on a missing field or an unknown kind", async () => {
    await expectInvalid({ venues: [without(validVenue, "address")] });
    await expectInvalid({ venues: [{ ...validVenue, name: "  " }] });
    await expectInvalid({ venues: [{ ...validVenue, kind: "brunch" }] });
  });

  it("throws a typed error on a non kebab-case id or duplicate ids", async () => {
    await expectInvalid({ venues: [{ ...validVenue, id: "Ferme des Essais" }] });
    await expectInvalid({ venues: [validVenue, validVenue] });
  });

  it("throws a typed error on no venues or non-object data", async () => {
    await expectInvalid({ venues: [] });
    await expectInvalid(null);
  });
});
