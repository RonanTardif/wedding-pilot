import { z } from "zod";
import { VenueRepositoryError, type VenueRepositoryPort } from "../../application/venue-repository-port";
import { VENUE_KINDS, type Venue } from "../../domain/venue";
import venuesData from "./venues.json";

const nonEmpty = z.string().trim().min(1);
const kebabCaseId = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "id must be kebab-case");

const venueSchema = z.object({
  id: kebabCaseId,
  name: nonEmpty,
  kind: z.enum(VENUE_KINDS),
  address: nonEmpty,
});

const venuesSchema = z.object({
  venues: z
    .array(venueSchema)
    .min(1)
    .refine((venues) => new Set(venues.map((v) => v.id)).size === venues.length, {
      message: "venue ids must be unique",
    }),
});

/** Reads the (fictional) venues from a JSON document, validated at this boundary. */
export class JsonVenueRepositoryAdapter implements VenueRepositoryPort {
  /** @param raw parsed JSON; defaults to the bundled `venues.json`. */
  constructor(private readonly raw: unknown = venuesData) {}

  async listVenues(): Promise<readonly Venue[]> {
    const parsed = venuesSchema.safeParse(this.raw);
    if (!parsed.success) {
      const where = parsed.error.issues.map((issue) => issue.path.join(".") || "(root)").join(", ");
      throw new VenueRepositoryError("VENUE_DATA_INVALID", `Invalid venue data at: ${where}`);
    }
    return parsed.data.venues.map(({ id, name, kind, address }) => ({ id, name, kind, address }));
  }
}
